# Stage 4A.4 — private request PDF and quotation preparation

Implemented locally, 1 November 2026, extending the
[staff dashboard](./service-management-dashboard.md) and the approved
[workflow](./platform-workflows.md). No hosted Supabase calls/changes, migrations,
founder accounts, deployment, external messages or payment collection occurred.
Existing authentication, MFA flows, role identifiers and prior migrations are unchanged.

## Local review

Use the existing local Docker/Supabase stack, apply pending migrations with
`npx supabase migration up --local`, then run `npm run dev:business`.
Open `http://localhost:3022/internal/requests`, authenticate through the existing
local sign-in/MFA flow using an authorized local staff identity, and open a request.
No permanent demo staff or founder credentials are created by this stage.
The existing Services and public Request a Quote routes are preserved.

The request detail now offers:

- **Download Request PDF**: branded internal export with reference/submission time,
  submitted client contact details, service/budget snapshots, requirements, optional
  deadline and attachment inventory. Marked **INTERNAL PROJECT REQUEST - CONFIDENTIAL**.
  Attachment names, size, type and scan status are included; file bytes, object keys
  and signed URLs are not embedded. Public uploads remain disabled.
- **Prepare Quotation**: one quotation thread per request, unique opaque `BWQ-…`
  number, sequential revisions and one active draft. Client details/service/reference
  are copied server-side from the original request, not supplied as arbitrary browser
  recipients. Submitted contact syntax is not independently verified ownership.
- **Save Draft**: edit project description, scope, deliverables, explicitly entered
  item amounts, delivery timeline, payment terms, validity date, client-facing notes
  and exclusions. No client-budget-derived price is proposed. An incomplete draft
  can be saved, but any included line must have a valid description, quantity and
  explicit amount. New amount inputs start blank, not at an invented service price.
- **Review and Finalize**: save first, validate completeness, review locked controls,
  and explicitly finalize. Confirm the founders agreed pricing outside the system.
  This is the operator's recorded attestation, not a voting/financial-approval engine.
- **Download Quotation PDF**: available only for a finalized revision; includes
  quotation number/revision, client/service/project, scope/deliverables, itemized
  prices, total, timeline, terms, validity and notes/exclusions. Internal agreement
  confirmation is retained internally, not printed as a client-facing approval.
- **History / Prepare new revision**: inspect prior finalized details, download their
  original bytes, or copy the latest finalized revision into a new editable draft.
  A fresh team-agreement confirmation is required on every new revision.

Quotation preparation does not change a request to quoted/approved or create a client
project. A finalized PDF is not proof of dispatch, agreement, payment or invoice.
No send action, recipient-verification workflow, quotation dispatch record, client
acceptance, tax/discount inference or payment gateway is implemented.

## Financial and validation contract

Currency is explicitly **XAF / FCFA**, with whole integer units. A line has a
description, integer quantity 1–100,000 and explicitly entered unit amount
0–1,000,000,000,000. Zero is allowed only as an explicitly entered amount.
At most 25 lines and a total no greater than 9,000,000,000,000 are supported.
These are technical bounds, not prices or service fees. JavaScript uses BigInt
for accumulation before safe conversion; PostgreSQL independently recomputes the
total using exact numeric arithmetic. Caller-supplied totals are rejected.

Finalization requires nonempty project/scope/deliverables/timeline/payment terms,
at least one complete line, team confirmation and a validity date from the current
UTC database date through 730 days ahead. Drafts can be incomplete; expired drafts
must have their validity reviewed before finalization. Quotation text, control
characters, exact allowed fields and JSON byte sizes are validated on both sides.
PDF document date is the draft's preparation date; actual finalization time is
recorded separately in the revision history. No legal/tax terms are invented.

## Permissions, RLS and private endpoints

New migration: `20261101020000_request_documents_quotations.sql`, applied **locally
only**. It adds three individually mapped permissions for Owner and Operations:

- `documents.export`, additionally requiring `inquiries.read` for request PDFs.
- `quotations.read`, additionally requiring `inquiries.read` for financial data.
- `quotations.manage`, additionally requiring both reads; finalization also requires
  `documents.export` because it creates the preserved private artifact.

Local totals are **4 roles / 22 permissions / 39 mappings**. Content and Technology
gain no quotation or export access. No user/profile/role assignment is provisioned.
The reviewed owner-bootstrap allowlist and exact-catalog local tests were explicitly
extended. The updated bootstrap must fail closed against an older hosted permission
catalog; it has not been executed hosted.

`business_private.quotations` and `business_private.quotation_revisions` have RLS,
read permission predicates and restrictive live verified-TOTP/AAL2 policies.
Authenticated callers have no direct table mutation grants; service-role ingress
has neither direct private table grants nor EXECUTE on these staff commands.
The schema remains unexposed to the Data API. AAL1, unassigned/inactive users and
unrelated roles remain denied, including direct database/API attempts.

Narrow public RPCs are `get_quotation_revision`, `list_request_quotations`,
`create_quotation_draft`, `save_quotation_draft`, `finalize_quotation`,
`export_project_request` and `export_quotation`. They use qualified references,
empty search paths, independent permission/MFA checks and authenticated-only grants.
Private validation/document helpers and the immutability trigger are not executable
by API roles. No grants/policies on existing modules are weakened.

The server-only repository uses the genuine caller's SSR session. The fixed
`/internal/quotation-api` adapter has private no-store/no-referrer/noindex responses;
mutations and PDF authorization require bounded JSON and the existing strict
configured Origin/Host/forwarded-header guard. GET reads history/revision data only;
it cannot finalize or authorize a download. Binary PDF responses are attachments,
nosniff and sandboxed. Blob downloads use in-memory object URLs, revoked shortly
after use. There is no public artifact URL or browser privileged credential.
The existing `/internal` proxy and dynamic request page enforce fresh sessions;
UI visibility is supplementary to server and database checks.

## Atomic revisions and immutable PDF bytes

Request-row locking serializes draft creation, so concurrent creation returns the
same active draft and creates one audit event. Saves use exact optimistic versions.
Finalization locks the revision, checks state/version, validates all terms, recomputes
the snapshot digest and stores the PDF hash/finalization actor/time with the audit
event in one transaction. Stale or concurrent attempts fail safely with PT409.
No automatic mutation retries are performed. Reload history after an uncertain result.

The trusted renderer first generates the final document from that saved snapshot.
Its bytes are written **create-only**, flushed to disk and hash-verified under
`.supabase/documents/quotations/<revision-uuid>-<sha256>.pdf` before the finalization
RPC is called. These files are private, outside public/static paths and Git-ignored.
The browser never supplies PDF bytes, a filesystem path or the archival hash.
A direct staff RPC invocation cannot place arbitrary bytes into the filesystem;
an absent/mismatched artifact fails closed at download.

Finalized rows cannot be edited/deleted by application commands, and a trigger
also rejects accidental updates/deletes. Only nullification of the actor FK during
legitimate account deletion is allowed without changing any document field.
New revisions do not mark old rows superseded in place: old content and bytes stay
unchanged and history identifies the later revision. Downloads read the original
archived bytes and verify SHA-256; they never silently regenerate an old document.

Filesystem writes and PostgreSQL cannot share a transaction. If finalization loses
its response, fails after file persistence or loses a concurrency race, a private
unreferenced artifact may remain. Keep it for reconciliation: inspect the revision
and its hash before any retry/cleanup. Never delete a potentially committed artifact
or overwrite a partial file blindly. No privileged access is partially provisioned.

**Backups must cover both the database and these private PDFs.** A Supabase logical
dump alone does not recover the artifact bytes. For this local stage, protect the
directory with the workstation account's ACL/full-disk encryption and restrict
backup access. A missing/tampered file requires restoring the exact matching hash
from a private backup. The PDFs themselves are not password encrypted or digitally
signed. Public hosting requires a separately reviewed durable private artifact store,
server write authority, retention, backup/restore and crash/orphan reconciliation.
Do not deploy this local filesystem design as an internet-production claim.

## PDF implementation and visual verification

No approved logo/image asset exists in the repository. Documents use the approved
company name, blue styling, `contact@bewiseinnovation.com` and `bewiseinnovation.com`;
no logo, address, registration number or business WhatsApp number was invented.

Server-only `pdf-lib`, `@pdf-lib/fontkit` and self-hosted OFL-licensed Noto Sans are
pinned dependencies. Trusted fonts/templates are used; no external URL, user HTML,
attachment or uploaded PDF is fetched/parsed by the renderer. Text wraps across A4
pages, including long tokens, with repeated branding and page numbers. Template
version 1 is recorded. Latin/French text is supported by the selected font subset;
unsupported glyphs fail rather than silently corrupting text. Broader script/font
support needs a later font and layout review. Rendering is bounded to 60 pages and
artifacts to 2 MB. PDFs are static and not fully tagged PDF/UA documents.

Synthetic request/quotation samples are privately retained under `.supabase/pdf-review`
for Poppler text and page rendering checks; no real request content is copied there.
Browser-generated test downloads/screenshots are also ignored and synthetic.

## Tests and file inventory

Commands:

```powershell
npm run test:quotations
npm run test:services
npm run test:services:local
npm run test:services:staff:browser
npx supabase test db --local
npm run test:db:fresh
npm run test:auth
npm run typecheck
npm run lint
npm run build
```

Final results:

- **9/9 new quotation/PDF/model/mocked-HTTP/artifact tests**: integer arithmetic,
  explicit zero versus missing price, overflow/fractions, agreement/validity guards,
  safe input, deterministic PDF bytes, multipage wrapping and numeric budget text,
  absence of active PDF content, POST/Origin and response privacy, corruption/path
  rejection and create-only artifact behavior.
- **193/193 local pgTAP assertions**, including 39 new quotation assertions for
  grants/RLS, AAL1/inactive/unassigned/other-role denial, exact calculations,
  duplicate draft prevention, immutable history, digest/version/null-version
  rejection and injected audit-failure rollback. SQL claims are synthetic, not
  real Auth sessions. The explicit null-version guard was hardened during local
  review without resetting development data and verified in the fresh replay.
- **80 real local Auth/REST/Storage/HTTP-handler checks**: actual signed TOTP/AAL2
  sessions, concurrent creation/finalization, one finalization audit, unauthorized
  export denial, stable previous-revision bytes after finalizing a newer version,
  binary HTTP response correctness and previous module regressions.
- **33 real Edge/Next staff browser checks**, including quotation preparation,
  explicit item entry, draft save, review/finalize, both actual PDF downloads,
  history/new revision, reset agreement and mobile width. **24 existing public
  browser checks** also passed, including anonymous idempotent requests.
- **32/32 existing services tests** and **78/78 authentication tests** passed.
- Fresh network-isolated **PostgreSQL 17** replay: all eight migrations in order,
  193 assertions, **30 owner-bootstrap checks** and existing real ticket/Auth-quota
  concurrency checks passed; its disposable container was removed. Existing local
  content-role rollback/cleanup concurrency tests passed **58/58**. One initial
  bounded legacy-binding run failed without stage details; count-only diagnostics
  were added and the same administrative SQL passed a clean rerun. No grants or
  guards were relaxed to force it through.
- Real request-ingress concurrency passed: 12 identical calls yield one receipt;
  per-email acceptance stays at 3 and global at 30 under concurrent load.
- TypeScript, ESLint and production build passed. The private request and API
  routes remain dynamic. A scan of all 18 production browser JavaScript files found
  no configured privileged secret values or server-secret variable names.
- Poppler rendered both synthetic PDFs and their latest pages were visually
  inspected. `pypdf` extraction verified the confidential label, client/attachment
  sections, quotation number/revision, explicitly entered total, validity, payment
  terms and invoice disclaimer; the internal agreement field is not printed.

Browser sessions are produced by disposable local Auth identities and seeded as
SSR cookies into an isolated Edge profile; this is not a new physical-device MFA
or manual sign-in test. No real emails or messages are sent. Early test-harness
selector/download-timing failures are not counted as passing runs.

Final local state: seven approved services, 42 options, 4 roles/22 permissions/39
mappings; zero Auth users, profiles, role assignments, quotation threads/revisions
or archival sidecar PDFs after exact synthetic fixture cleanup. The one pre-existing
local request was preserved. Synthetic review PDFs/downloads/screenshots remain
privately ignored. Existing private environment files were not modified. The local
server was restarted through the secure launcher; catalog HTTP 200 and the anonymous
staff-denial page were confirmed at localhost:3022. Recovery remains disabled.

Dependency audit reported 16 moderate advisories in the existing lint/tooling tree,
with none listed against the three added PDF/font runtime packages. No forced lint
stack upgrades were made; resolve/reassess the tooling advisories before deployment.

Created: the migration, `src/features/quotations/model.ts`, `pdf.ts`, `artifacts.ts`,
`server.ts`, `http.ts`, `panel.tsx`, `panel.module.css`, `quotations.test.ts`,
`src/app/internal/quotation-api/route.ts`, `supabase/tests/quotations.test.sql` and
this report.

Modified: the request workspace (quotation panel integration), package/lockfile,
README, local integration/browser/fresh-database runners, exact catalog expectations
in RBAC/business/role-transaction tests and the local owner-bootstrap permission
allowlist. Existing business tests now scope their requests to exact synthetic
service IDs; an unrelated pre-existing local request was preserved. Test-only
cleanup temporarily disables the immutability trigger under an exclusive table lock,
deletes only its exact synthetic revisions and re-enables it before commit. This is
not an application cleanup API or a hosted procedure.

## Remaining work and recommended next stage

Review actual company terms, the layouts, privacy/retention and verified-contact
procedures before handling real client documents. No local founder account was
created for manual dashboard access; use an independently approved local staff
identity. Attachments remain metadata-only in these PDFs, and uploads/scanning are
still disabled/unimplemented. Financial approval remains the external founder
discussion; there is no tax engine, signature, invoice, payments or sending feature.

Next recommended stage: verified client contact and a deliberately authorized
quotation dispatch/revision tracking workflow, with safe failure reconciliation.
It requires separate approval; no real recipient interaction or founder onboarding
is implied by this stage.
