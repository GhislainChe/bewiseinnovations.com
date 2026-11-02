# Stage 4A.5 — quotation delivery preparation and original branding

Implemented locally on 1 November 2026, building on [Stage 4A.4](./request-pdf-and-quotations.md).
No hosted Supabase access or changes, real messages, deployment, founder accounts,
SMTP credentials, DNS changes or authentication-template changes were made.

## Local review and workflow

Use the existing local Docker/Supabase stack and private `.env.integration.local`.
Apply reviewed local migrations with `npx supabase migration up --local`, then run
`npm run dev:business`. The launcher rejects non-local Supabase configuration and
serves `http://localhost:3022`; recovery stays disabled. Existing private environment
files were preserved. No permanent demo staff credentials are created.

Open `/internal/requests` using an active, authorized LOCAL staff identity with a
verified TOTP/AAL2 session. Open a request, select a finalized quotation revision,
and use **Send Quotation**. `/internal/services`, `/services` and
`/request-a-quote` retain their existing behavior. Anonymous visitors cannot read
the private inbox, previews, delivery history or PDFs.

1. Select a finalized revision and WhatsApp or Email; **Prepare delivery** records
   READY for that exact revision/channel. Repeating preparation returns the existing
   record rather than inventing another dispatch.
2. Review the submitted recipient and attachment filename, revision and byte size.
   Recipients come from the linked request and must match the immutable quotation's
   contact snapshot. No arbitrary browser-supplied recipient is accepted. Submitted
   email/WhatsApp ownership is **not** independently verified by this module.
3. **Download exact attachment** reads and hash-verifies the archived finalized PDF.
   Missing/corrupt files block preparation/manual confirmation. Existing records can
   still be marked NEEDS_FOLLOW_UP; this makes no delivery claim.
4. WhatsApp: review the recipient checkbox, explicitly open the conversation, then
   manually attach the downloaded PDF and send. Opening the link does not record
   dispatch. The personalized message is shown separately for manual copying.
5. Email: review recipient, fixed subject, responsive branded preview and attachment
   metadata. **Sending is disabled.** There is no SMTP/provider invocation, send API,
   mailto attachment trick or environment flag that enables sending.
6. After an actual external manual send, explicitly attest that this exact PDF was
   sent to this recipient, optionally add internal notes, then record manual dispatch.
   MANUALLY_SENT means staff-confirmed dispatch, **not** receipt or reading. Alternatively
   record NEEDS_FOLLOW_UP. History remains tied to the selected revision/channel.

Pricing remains explicitly entered after the founders' off-platform agreement.
This stage introduces no voting, chat, financial approval or payment workflow.
Dispatch does not automatically change request status or create a client project.

## Original brand assets and document versions

All five supplied PNG files were copied byte-for-byte to `public/brand/original/`.
`public/brand/manifest.json` records dimensions, SHA-256 and observed colors. The
full **renewed logo.png** is used in PDFs, the delivery header and email; other
supplied variants are preserved without recoloring, cropping, lettering changes or
proportion changes. The full logo's ratio is 2212:624. Its blue is predominantly
**#2A3186**, distinct from the working palette's #2563EB. The original tagline
asset's main blue is **#3E65AF**. Original colors remain intact; the working palette
remains primary #2563EB, navy #103B92, dark #071C45, text #111827, secondary #64748B,
light #F8FAFC and border #E2E8F0. The live text tagline is “Smarter Tech, Greater Impact.”

Quicksand is pinned locally, with its OFL license retained; no Google Fonts request
is needed. PDFs embed Quicksand and use the existing Noto Sans Latin fallback for
supported additional glyphs. Unsupported glyphs fail before export/finalization
instead of silently disappearing. Emails use Quicksand if available, then Arial/
sans-serif; they do not fetch remote fonts. Full multilingual shaping, PDF/UA
tagging and verification across all email clients are outside this stage.

PDF template **2** adds the original logo, tagline, contact footer, consistent blue
accents, embedded typography and repeated page headers/footers. Request exports
retain **INTERNAL PROJECT REQUEST - CONFIDENTIAL** and confidential footers.
Quotations retain revision/validity, explicitly entered FCFA (XAF) amounts and the
“not an invoice or proof of payment” notice. Untrusted text is rendered as static
text, never HTML, file paths, remote content or executable PDF actions.

Finalized version-1 PDF archives are never regenerated or overwritten. The frozen
`pdf-v1.ts` renderer and pre-change synthetic SHA-256 fixture protect compatibility;
downloads always read the archived bytes regardless of template version. New drafts
default to version 2. An existing version-1 draft must be saved to adopt version 2
before finalization; finalized rows are not bulk-updated. New revisions receive new
archives. Existing artifact storage, hash checks and finalization guards remain.

## Email and WhatsApp privacy

WhatsApp URLs are generated using `URL` with a fixed `https://wa.me/` host and an
international E.164-style number. No default country is guessed. The query contains
only generic company text: no client name, scope, price, quotation reference,
private document URL or attachment. The UI shows the richer personalized message
for manual copying. Links use no-referrer and noopener/noreferrer; tests never
open WhatsApp or send a message.

Email HTML escapes client/service/reference fields and uses the exact subject
**Your Project Quotation | BE WISE INNOVATIONS**. The navy header displays the
original logo on a white plate, preserving its black lettering and original blue.
The footer includes the company, tagline, contact@bewiseinnovation.com and
bewiseinnovation.com. Internal notes and private financial payloads are not copied
into the HTML or links; the price remains in the private PDF attachment.

The outbound template references `cid:bewise-official-logo@bewiseinnovation.com`.
The server-only `emailPackage` prepares the selected archived PDF bytes plus the
original PNG as an inline CID attachment. A future approved transport must generate
the matching multipart/related MIME message; no public asset host is required for
this strategy. Browser previews replace the CID with the public logo's data bytes
inside a sandboxed iframe with a restrictive CSP. The outbound HTML contains no
localhost URL or private filesystem path. No external analytics or tracking pixels
are added. Validate actual MIME rendering and logo availability before enabling
real delivery; a browser preview is not an email-delivery test.

## Local database and authorization

New migration: `20261101030000_quotation_delivery_brand.sql` (LOCAL ONLY).
Earlier migration files and authentication/MFA flows are unchanged.

- Adds only `quotations.send`, granted to `platform_owner` and `operations_lead`.
  Local totals are four roles, **23 permissions and 41 mappings**; previous hosted
  counts are unaffected. The owner-bootstrap allowlist and local regression
  expectations include the new permission without executing bootstrap.
- Adds private `business_private.quotation_deliveries` and
  `business_private.quotation_delivery_events`, indexes, immutable-target and
  append-only event guards, RLS and four authenticated RPCs:
  `get_quotation_delivery`, `list_quotation_deliveries`,
  `prepare_quotation_delivery`, `record_quotation_dispatch`.
- Every RPC checks active role membership, `inquiries.read`, `quotations.read`,
  `quotations.send` and the existing live-session verified-TOTP/AAL2 requirement.
  Server preparation, preview and attachment access also require `documents.export`.
  Ordinary API roles have no direct mutation grants; anonymous/service-role dispatch
  execution is denied. No private schema is exposed or public bucket introduced.
- Target request/revision/channel/recipient/hash and initiation metadata are fixed.
  One record exists per revision/channel; changing a document requires selecting a
  different finalized revision. This minimal stage does not model repeated sends
  or alternate recipients for a previously confirmed revision/channel.
- Preparation uses an advisory transaction lock; confirmation uses row locking,
  optimistic versions and a caller-generated event UUID bound to a payload hash.
  Concurrent identical confirmations produce one event/audit; reusing a key with
  different content or confirming an already terminal dispatch fails with conflict.
  A failed audit insert rolls back the state/event update atomically.
- `quotation.dispatch_prepared` and `quotation.dispatch_recorded` preserve actor,
  revision/channel and staff-confirmation semantics. Contacts/notes are not duplicated
  into general audit metadata. Event history is append-only; deleted staff actors
  may be anonymized by the existing FK behavior without erasing history.

`/internal/delivery-api` is a private no-store/no-referrer/noindex endpoint. GET only
reads history/preview; POST performs preparation, audited download or confirmation
under the existing strict trusted-Origin check and bounded JSON validation. The
server uses the genuine caller's SSR session, not privileged credentials, for these
operations. Files remain outside `public/`. There are no public PDF URLs.

The UI prevents concurrent clicks and automatically retries nothing. On ambiguous
failure it retains the confirmation intent in component memory and requires history
inspection before a different action. Reloading history clears local intent and
shows authoritative state; database idempotency/terminal guards remain in force.
No session tokens or document bytes are persisted in browser storage by this feature.

## Validation and synthetic artifacts

See the final validation results below. Fixtures use `.invalid` contacts and local
disposable staff identities; no real message is sent. The pre-existing local request
and approved seven-service/42-budget catalog are preserved. New fixture cleanup
locks only the exact synthetic request/revisions, verifies identifying fixture
attributes, and removes its delivery dependencies transactionally before deleting
its own local identities/artifacts. It never targets hosted Supabase.

Synthetic review files are Git-ignored under `.supabase/brand-review/`:
`request.pdf`, two-page `quotation.pdf`, rendered page PNGs and `email.html`.
Original logo proportions/quality, repeated headers/footers, long text/page breaks,
XAF item totals, revision labels and confidentiality labels were visually reviewed.
Actual Edge screenshots under `.supabase/browser-tests/` cover the protected delivery
panel and responsive email; browser review does not establish Outlook/Gmail support.

During development an initial SQL delimiter error was caught in the new migration.
Only its newly created, empty local objects were reconciled after verifying no new
finalized data existed. The final migration is explicitly transactional and is
validated by a complete isolated fresh PostgreSQL replay. No existing development
request, hosted database or prior migration history was reset or repaired.

Validation results (all local):

- Delivery unit/HTTP/branding regressions: **9/9**; quotation regressions **9/9**;
  service/request/staff regressions **32/32**; authentication regressions **78/78**.
  These are automated unit/adapter tests, not proof of real email delivery.
- PostgreSQL pgTAP: **228/228**, including **35** delivery assertions. All nine
  migrations also replayed in order in a new network-isolated PostgreSQL 17
  container, followed by the same 228 assertions and repeat catalog-seed check.
- Real LOCAL Supabase Auth/MFA/caller-session/PostgreSQL integration: **112/112**,
  including concurrent identical dispatch confirmation, one confirmation audit,
  changed-payload rejection, exact PDF/CID package bytes, missing-artifact failure,
  follow-up recovery and unchanged historical version-1 artifact delivery.
- Actual local Edge/Next/Auth/MFA/staff-RLS browser suite: **47/47**. Covers the
  prepare/download/manual-dispatch UI, double click, disabled sandboxed email
  preview, mobile layout, three staff boundaries and existing catalog/inbox flows.
  The runner now waits for document replacement on same-path navigation and for
  enabled action buttons; it previously raced page/state updates. An interrupted
  development run also led to exact-fixture teardown being made transactional,
  with request/revision locks preventing an in-flight prepare from racing cleanup.
- Isolated owner-bootstrap tests: **30/30**. Local content-role binding/cleanup:
  **58/58**, including rollback and concurrent-winner checks. No bootstrap was
  performed against hosted Supabase.
- Auth-store concurrency: ticket redemption **1/12** winners, email quota **3/12**,
  global quota **30/33**, as expected. Service-request concurrency: 12 identical
  submissions produce one receipt, per-email total three and global total 30.
  Repeat/concurrent catalog initialization passed and rolled back its fixtures.
- Synthetic PDF extraction checks: **6/6**, plus visual inspection of all three
  rendered sample pages and the responsive email. Browser samples use dummy data;
  no real WhatsApp navigation or email transport was exercised.
- TypeScript, zero-warning ESLint and production build passed. **19** production
  browser assets were checked against configured private secret values, with none
  found. Private environment/backup/artifact paths remain Git-ignored.

Final local state: seven approved services, 42 budgets, four roles, 23 permissions,
41 mappings, zero Auth users/profiles/assignments/quotations/deliveries/events and
the original one project request preserved. Synthetic database fixtures and their
archived quotations were removed. Deliberately synthetic visual-review artifacts
remain private/Git-ignored. The local-only development launcher was restarted after
the build; it creates no staff identity and keeps recovery disabled.

## File inventory for this stage

- `src/features/brand/identity.ts`, `assets.ts`: shared constants and fixed-path,
  integrity-checked original image loading.
- `public/brand/original/*`, `manifest.json`, `fonts/*`: five original PNGs,
  provenance/checksums, local Quicksand web fonts and license.
- `src/features/quotations/pdf.ts`, `pdf-v1.ts`, `pdf-v2.ts`, `panel.tsx`,
  `quotations.test.ts`: version dispatch, frozen legacy renderer, new branding,
  finalized-revision delivery integration and updated template expectation.
- `src/features/delivery/model.ts`, `server.ts`, `http.ts`, `panel.tsx`,
  `panel.module.css`, `delivery.test.ts`, `legacy-pdf-baseline.json`: preparation,
  safe message/HTML construction, disabled email package, protected UI and tests.
- `src/app/internal/delivery-api/route.ts`: private HTTP adapter.
- `supabase/migrations/20261101030000_quotation_delivery_brand.sql` and
  `supabase/tests/delivery.test.sql`: local schema, permission and transactional tests.
- `supabase/tests/rbac.test.sql`, `services_requests.test.sql`, `quotations.test.sql`,
  `supabase/admin/bootstrap-platform-owner.sql`: local count/permission expectations.
- `scripts/test-local-services-integration.ts`, `test-local-staff-browser.mjs`,
  `local-staff-fixture-cleanup.mjs`, `test-fresh-mfa-database.mjs`,
  `test-content-role-transactions.mjs`: caller-session integration, isolated browser,
  exact-fixture teardown and fresh replay/regression expectations.
- `package.json`, `package-lock.json`, `README.md` and this report: pinned font,
  delivery test command and stage documentation. Changes from earlier local stages
  already present in the worktree were preserved.

## Remaining requirements and next stage

Real delivery remains disabled. Before enabling it, separately approve deployment
of the business migrations, protected production PDF storage with backups/restoration
covering both database and immutable artifact bytes, HTTPS/trusted-Origin setup,
staff provisioning/MFA, verified client recipient handling and retention rules.
Approve/configure a server-only email transport independently of Supabase Auth
email templates; test MIME/CID/PDF rendering with local mail capture, safe failures,
provider idempotency, throttling and uncertain outcomes before any real recipient.
Do not equate provider acceptance with receipt/reading. Never reuse Auth SMTP
credentials automatically or enable a public PDF bucket.

Recommended next stage: local quotation-delivery acceptance testing and approved
transport design using local email capture, including recipient verification,
MIME compatibility and failure/reconciliation behavior. No SMTP transport, real
delivery, client acceptance, repeated-send scheduling, provider receipts, payments,
unrelated module or founder onboarding is authorized by this stage.
