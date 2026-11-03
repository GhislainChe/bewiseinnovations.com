# Opportunities & Programs — Stage 4E.1

Local implementation and testing, 2 November 2026. No hosted Supabase changes,
deployment, founder accounts, real programs, messages, payments, ticketing or QR
scanning. Earlier implementation-plan stage numbering was provisional; this
report follows the user's current Stage 4E.1 scope.

## Features and review routes

- `/opportunities`: published catalog, category/type, application availability,
  approved optional visuals, loading, empty and unavailable states.
- `/opportunities/[slug]`: published description, eligibility/requirements,
  configured duration, delivery/location, explicit UTC window, available places
  and optional approved XAF/FCFA fee. Apply/form appears only while accepting.
- `/internal/opportunities`: protected listing workspace and private Operations
  application inbox, with different controls according to genuine permissions.
- `/api/opportunities`: public-safe catalog or `?slug=...` detail.
- `/api/program-applications`: bounded anonymous POST only. No public lookup,
  application editing, private records or document access.
- `/internal/opportunities-api`: caller-authorized fixed read/command interface.

There is **no persistent opportunity seed**. The public catalog is empty until
authorized staff enter approved facts and deliberately publish. No dates, fees,
venues or capacity figures are invented. Existing original company assets,
palette and self-hosted Quicksand are reused; no opportunity images are fabricated.

To review with the existing private LOCAL Supabase environment:

```powershell
npx supabase migration up --local
npm run dev:business
```

Use `http://localhost:3022/opportunities` and
`http://localhost:3022/internal/opportunities`. Staff review requires an active,
authorized LOCAL identity with verified AAL2. No permanent demo login is supplied.
`npm run test:opportunities:local` runs the complete disposable local workflow with
headless Chrome and cleans up its identities and records. Do not substitute the
hosted-test launcher or credentials.

## Listing and intake workflow

1. Content or Owner creates an internship, training, workshop or other opportunity
   draft with stable unique slug, title, plain-text description, eligibility,
   requirements and optional registered approved image.
2. Operations enters approved duration, mode, public delivery/location, UTC
   opening/closing instants, optional capacity, optional whole-XAF fee/instructions
   and reviewed questions. Unknown values stay blank/null. An explicit approval
   attestation is required; there is no founder voting or financial approval board.
3. Content/Owner explicitly publishes the public copy. Publication alone never
   opens applications. Working-copy edits do not change published copy until
   explicitly republished. Unpublishing also disables intake; republishing does
   not silently reopen it.
4. Operations explicitly enables applications. Server/database eligibility also
   requires a published listing, configured form, reached opening time, a deadline
   not yet reached, and remaining capacity if specified. A stale open browser tab
   cannot bypass these checks.
5. Approved changes to questions, operational facts or intake enablement create
   another immutable form version. Applications retain their exact form version,
   submitted answers and program/operational snapshot. Old unsubmitted form IDs
   are rejected; the visitor must reload before submitting current answers.

Listing publication and intake each use explicit version checks. Slugs remain
fixed after creation; duplicate slugs or stale updates fail safely. No automatic
mutation retry occurs. After uncertain results, reload and inspect before trying
again. Concurrent configuration saves accept only the current version.

Opening/closing values are entered and displayed as **UTC**, not inferred from
the browser/host timezone. Windows may be unspecified when explicitly approved.
Deadline restrictions govern submission; Operations can review existing
applications after the deadline or after intake closes.

## Forms, references and abuse protection

Base fields are full name, normalized email, optional international WhatsApp,
short motivation and explicit application-processing consent
(`program-applications-v1`). There is no visitor account, DOB/address/government
identifier field, payment field or public file input.

Up to 12 declarative questions support short text, long text, one approved choice,
or Yes/No, with required/optional settings. Required Yes/No accepts either actual
boolean answer, including false. IDs, options, exact allowed fields and lengths
are validated in TypeScript and PostgreSQL. There is no executable question logic,
HTML/embed support, arbitrary upload question or hidden financial state. Labels,
answers and descriptions are safely escaped as text. Staff must review question
relevance/minimization; a schema cannot determine whether every free-text question
or answer is appropriate personal data.

Each genuine new application receives an opaque unique `BWA-...` reference.
The browser holds one idempotency key/body in RAM, blocks repeated submissions
and makes no automatic retries. Identical retries return the same receipt;
changed-payload reuse fails. Product/module/domain-separated HMACs identify
normalized email per opportunity and payload/key identities, never caller-supplied
hashes. A database unique constraint and atomic transactions prevent duplicate
applications across simultaneous server instances.

Privacy-preserving duplicate behavior: a fresh-key duplicate does not replace
the existing contact, answers, consent or reference. It receives an indistinguishable
generic receipt with a separate unbound reference, never the original application
reference. The UI calls it a **submission reference**, explains that it is not
acceptance or a place reservation, and tells previous applicants to retain their
original reference. There is no anonymous membership/reference lookup. If that
original receipt is lost, independently verified Operations support is required.

Durable hourly PostgreSQL limits are **100 global**, **3 per normalized email
across programs**, and **50 per opportunity**. Keys are domain-separated HMACs.
Successful idempotent/duplicate attempts consume quota too. Failed transactions
roll back; absent credentials, missing/erroring durable storage or audit failures
fail closed. No in-memory-only fallback and no trust in forwarded IP headers.
Shared counters are not reset on application restart. Keep the submission signing
key stable; rotation requires a reviewed deduplication/suppression migration.

The server ingress is explicitly LOCAL-only and limited to one fixed RPC URL,
POST, no redirects and a bounded timeout. Its private credential cannot be used
as the caller identity for staff decisions. Anonymous and ordinary API roles
cannot invoke this privileged RPC directly. The public endpoint strictly checks
configured Origin/Host/forwarded-header consistency and exact JSON contracts.
Its explicit envelope limit is 32 KiB, with a 30 KB normalized payload limit;
other public form endpoints retain their existing body limits. Production edge
rate limits/challenges and resource protection remain necessary before hosting.

## Private review and places

Operations/Owner can filter by opportunity/status and search an exact reference,
review applicant contacts, motivation, frozen question labels and answers,
document metadata and review history. The inbox shows up to 200 matching records.
It locks actions while filters reload, prevents duplicate commands and wraps long
references on narrow screens. All writes recheck the exact record version.

Supported transitions:

- Submitted → Under Review or Withdrawn.
- Under Review → Shortlisted, Rejected or Withdrawn.
- Shortlisted → Accepted, Rejected or Withdrawn.
- Accepted → Withdrawn.
- Rejected/Withdrawn are terminal; no automatic re-entry or revival.

Every decision requires a private reason or independently verified withdrawal
case reference. Actor, transition and time are recorded transactionally in review
history and the existing audit mechanism; audit metadata does not contain contact
details, answers or private reasons. There is no automatic ranking, acceptance,
rejection, notification or financial decision.

**Capacity means accepted active enrollments, not submitted applications.** Pending
applications do not reserve places. Acceptance locks the opportunity and allocates
an enrollment atomically; concurrent last-place decisions cannot overbook.
Withdrawing an accepted application deactivates its enrollment and releases the
place while retaining history. Capacity cannot be reduced below active accepted
enrollments. A zero capacity prevents new intake. No capacity is inferred from an
unset value, and submission never guarantees acceptance.

Account-free applicants request correction or withdrawal privately through
Operations. A reference or knowledge of an email alone is not sufficient proof
of identity. There is no insecure public email-only status-change endpoint.
Withdrawal is an operational status change, not automatic deletion of review
records; retention/erasure governance must be approved before real data collection.

## Fees, documents and exports

Unknown fees remain null and are not advertised as free. An explicitly configured
zero may be shown as 0 FCFA. A positive fee requires approved physical on-site
instructions. Public wording clearly states no online payment or payment during
application. Acceptance does not mean paid; there are no payment links, payment
records, automated fee checks or collection integrations.

Private `program-application-documents` Storage bucket and metadata support an
authorized review/download model: exact application/document key, bounded name,
PDF/JPEG/PNG, maximum 10 MiB, checksum and quarantined/clean/rejected scan state.
Only a trusted future ingestion/scanning pipeline may create/mark real files.
No public/staff upload, reservation/finalization or scan-override endpoint exists.
The public form explicitly explains that uploads are disabled.

Operations/Owner can view authorized metadata; download is enabled only for clean
files. A deliberate Origin-checked POST repeats application-read/AAL2 checks,
audits authorization, and uses the genuine caller's Storage RLS session to request
a 60-second signed URL. It is returned only in a private no-store response and
never logged. Do not share bearer URLs or applicant documents. Technology and
Content cannot download files without a separately implemented authorized release.

An explicit audited **private summary CSV** requires `applications.read` and the
existing `documents.export`. It contains only reference, opportunity title,
status and submission date, excludes applicant contact/answers, escapes quotes
and neutralizes spreadsheet formula prefixes. Export respects the current filters
and 200-record limit. No quotation/PDF code or previously finalized bytes changed.

## Database and authorization

New LOCAL migration: `20261102040000_opportunities_programs.sql`.
Eight tables are in the existing unexposed `business_private` schema:
`opportunity_assets`, `opportunities`, `opportunity_forms`,
`program_applications`, `program_reviews`, `program_enrollments`,
`program_application_buckets`, `program_application_documents`.

All eight enable RLS and restrictive authenticated MFA policies. Direct API-role
table CRUD is revoked. Narrow SECURITY DEFINER functions use empty search_path,
qualified objects and explicit caller permission/AAL2 checks. Storage has a
bucket-specific clean-document read policy. The public projection omits applicant
identities, private reviews/counts, working drafts, hashes and document metadata.
Program/forms/enrollment foreign keys prevent cross-opportunity substitutions.
Form snapshots cannot be overwritten; sensitive mutations/audits are atomic.

Three new permission codes, explicitly mapped only to Owner and Operations:

- `applications.read`: private applications and clean-document access.
- `applications.manage`: decisions, together with `applications.read`.
- `programs.operations.manage`: approved windows, forms, fees, places and intake.

Existing `content.read/create/update/publish` govern public copy/publication;
`documents.export` additionally gates summary exports. No role identifiers are
changed. Current LOCAL catalog: **4 roles, 32 permissions, 61 mappings**.
Owner administration is retained. Content cannot read applications or configure
fees/capacity; Operations cannot edit/publish editorial copy through its operational
permission. Technology has **no broad applicant or document access**. A separately
reviewed minimal technical-assessment release is deferred, rather than pretending
it exists or granting unrestricted application permissions.

The existing SSR gateway verifies identity, active profile, assigned role,
permissions, current AAL2 session and verified TOTP. Database checks repeat the
boundary, including direct definer RPC calls. Genuine caller JWTs are used for
staff/Storage decisions; service-role credentials are confined to trusted public
ingress and disposable LOCAL test setup. No authentication/MFA flow was rebuilt.

## Executed validation

- **12/12** focused unit/model/mocked-adapter tests: permissions/contracts,
  explicit facts, UTC/invalid calendar dates, fees, question types/choices,
  required boolean false, consent, normalization, statuses, safe CSV/formula
  handling, Origin, generic receipts and failed/missing durable-store configuration.
- **167/167** combined unit/adapter regressions: 78 Auth plus 89 business tests
  (32 Services, 9 Quotations, 9 Delivery, 7 Projects, 11 Products, 9 Magazine,
  12 Opportunities). Legacy PDF and original brand checksum checks passed.
- **451/451** pgTAP assertions on the active local database, including **57 new
  program assertions**. A fresh network-isolated PostgreSQL 17 instance replayed
  **all 13 migrations** and passed the same 451 checks, 30 owner-bootstrap checks
  and existing ticket/shared recovery-quota concurrency checks. Local development
  data was preserved and the disposable preflight container removed.
- **46 real LOCAL Auth/TOTP/JWT/API checks**: AAL1/forged JWT denial, genuine AAL2
  roles, inactive/unassigned/Content/Technology applicant denial, publication
  versus intake, future opening/expired deadline rejection, immutable question
  history, stale forms, unchanged/changed idempotency and duplicate safety,
  two-instance per-email race (3/8 accepted, one stored row), configuration CAS
  (one winner), concurrent last-place acceptance (1/2), withdrawal/reallocation,
  safe exports and private document boundaries.
- The real document fixture reused original supplied logo bytes privately in
  LOCAL Storage. Quarantined download failed; simulated trusted scan completion
  permitted a genuine caller-signed download whose bytes matched SHA-256.
  Unauthenticated public access and Technology download failed. This proves the
  authorization/download path, **not the existence of a malware scanner**.
- **20 actual headless Chrome checks**: anonymous/Technology staff denial,
  Content draft/publication, no applicant inbox for Content, published-but-closed
  public page, Operations-controlled questions/intake, anonymous form validation,
  consent and single stored submission after repeated submits, frozen answers in
  private review, status progression through acceptance, public Apply removal at
  capacity, applicant privacy and mobile public/inbox layouts. The Git-ignored
  synthetic screenshot `.supabase/browser-tests/opportunities-public-mobile.png`
  was visually inspected. No real program or physical-device MFA test is claimed.

TypeScript, ESLint and the production build passed. All **32 generated production
browser artifacts** were scanned in memory against privately configured secret
values; none were found. Private environment values were not printed or modified.
The existing local content-role binding/cleanup suite also passed **58 assertions**
against the current 32-permission/61-mapping catalog. Tests are LOCAL only; no
hosted checks or writes. The identified development server was stopped for build
validation and the same local-only launcher restarted afterward, without a second
server or recovery enablement.

Post-test verification found zero opportunities, applications, forms, reviews,
enrollments, document metadata/Storage objects, test Auth identities, profiles and
role assignments. The original seven services, 42 budget options, client request,
Meet My Crew draft and four magazine categories remain. Cleanup targets only
exact run UUIDs/prefixes and known storage keys. Shared hourly quota counters are
preserved; no broad counter or unrelated-data reset is performed.

## Remaining limitations and next stage

No real opportunity content, schedule, fees, capacity or approved visuals have
been supplied. Real collection/public hosting requires approved program facts,
privacy/retention/minors and identity-verification policies, reviewed minimal
questions, production abuse protection, stable secrets and a separate deployment
review. Submitted email/phone ownership is not independently verified, and there
is no automated messaging/double-opt-in or acceptance notification.

Public uploads, scanner/quarantine worker, technical assessment releases, private
inbox pagination beyond 200, richer review assignment, applicant self-service
corrections and re-entry are deferred. The initial plain-text listings and UTC
editor are intentionally functional; no broad visual redesign or task board.

Recommended next stage: review this workflow and applicant-data governance,
provide approved program facts/questions, then separately approve secure document
ingestion or narrowly scoped technical review if needed. No event ticketing,
founder onboarding or next module begins automatically.

## File inventory

New feature namespace `src/features/opportunities/`: models/validation, caller
repository, fixed ingress, public/submission/staff UI, scoped responsive styles,
HTTP adapters and focused tests. New App Router files under `src/app/opportunities/`,
`src/app/api/opportunities/`, `src/app/api/program-applications/`,
`src/app/internal/opportunities/` and `src/app/internal/opportunities-api/`.

New SQL migration above and `supabase/tests/opportunities.test.sql`.
New `scripts/test-local-opportunities-integration.ts` and
`scripts/test-opportunities-browser.mjs` reuse local Auth/database/browser helpers.
The Auth fixture helper adds exact-key LOCAL private-storage setup/cleanup; the
browser helper waits for stable layout and verifies its click target.

Updated public/staff navigation, package scripts, README, current local permission
and RLS-count test expectations, fresh migration runner, existing local integration
mapping checks, and reviewed owner-bootstrap permission prerequisites. No prior
deployed migration, private environment value, original brand asset, finalized
quotation document, hosted settings or actual founder binding was modified.
