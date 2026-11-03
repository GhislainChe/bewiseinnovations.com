# Stage 4F.1 — Events, registration and QR ticketing

Completed locally on 2 November 2026. Hosted Supabase was not contacted or modified.
No real events, attendees, founder accounts, invitations, messages or payments were
created. Synthetic local Auth/database/browser fixtures were removed after testing.
Existing authentication, MFA and finalized quotation document renderers are unchanged.

## Scope and routes

The module supports independent editorial publication, public/private visibility,
physical/online/hybrid format, explicit UTC instants with an IANA event timezone,
approved venue/platform, restricted joining link, category, speakers, schedule,
registration windows, capacity, free/paid classification and whole-XAF fee terms.
Completion/cancellation are independent of publication and registration opening.
Public pages distinguish upcoming/ongoing and past events and display approved recaps.
No real event or poster is seeded.

- `/events` and `/events/[slug]`: published **public** events only; private and
  unpublished slugs return a generic not-found response and disclose no event metadata.
- `/events/private#invite=…`: generic invitation landing page. The fragment is
  removed before the React form uses a one-use, memory-only handoff.
- `/events/ticket#receipt=…`: generic private registration/ticket portal.
- `/internal/events`: editorial and Operations workspace, scoped by permissions.
- `/internal/events/check-in`: AAL2-protected scanner, attendance list/count and
  authorized manual ticket-reference fallback.
- `/api/events`: safe public projection. `/api/event-registrations`: anonymous
  registration POST. `/events/access-api`: fixed private guest/receipt operations.
- `/internal/events-api`: authenticated, authorized staff operations and private
  POST ticket download. No public PDF/download URL or general privileged RPC proxy.

All business features remain guarded by the existing **local-only** runtime gate.
`npm run dev:business` securely loads `.env.integration.local`, checks the exact local
Supabase endpoint `http://127.0.0.1:65421`, and serves `http://localhost:3022`.
It does not load the hosted-test file. Recovery stays disabled, diagnostics and
request-output forwarding stay disabled, and no environment file was overwritten.

## Database and permissions

New local migration: `20261102050000_events_registration_tickets.sql`.
Eight tables in `business_private`: `event_assets`, `events`, `event_invites`,
`event_registrations`, `event_payment_checks`, `event_tickets`, `event_attendance`,
`event_buckets`. All have RLS and restrictive MFA policies; ordinary API roles
receive no direct table access. Fixed SECURITY DEFINER RPCs with empty search paths
perform independent permission/AAL2 checks and safe projections. Private helpers
and schemas remain inaccessible through the Data API.

New permissions `events.operations.manage` and `events.checkin` are explicitly
mapped only to Platform Owner and Operations. The local cumulative baseline is
4 roles, 34 permissions, 65 mappings, 14 migrations and 35 private business RLS
tables. Previously deployed migrations are unchanged.

Existing `content.read/create/update/publish` handles editorial copy and publication.
Communications can edit approved public copy, speakers, schedule and recap, but
cannot read attendees, issue invitations/tickets, inspect private operational
logistics or check in guests. Operations controls logistics, intake and payment
records; registration work additionally requires `registrations.read/manage`.
Staff PDF export requires `registrations.read` plus `documents.export`.
Scanning requires `events.checkin`; its projection excludes contact and financial
payloads. Technology and unassigned identities gain no attendee access. All checks
apply both in the server repository and database functions, using the genuine caller
session rather than service-role authorization.

## Private eligibility and recipient access

Knowing a slug or forwarding the invitation link is insufficient. Operations must
independently verify the recipient mailbox **and event eligibility**, then prepare:

1. A random 256-bit invitation token, delivered in a fragment-only link.
2. A separate random 128-bit recipient code, released through an independently
   verified channel. Never append it to the link or deliver both together.

The recipient explicitly POSTs the original link token, matching verified email
and separate code. The database stores only credential hashes. Correct verification
creates a random, rotating guest capability with 15-minute expiry, bound to that
invitation and event. An HttpOnly, SameSite=Strict `/events` cookie carries it;
Secure is required for HTTPS, omitted only on the current loopback HTTP runtime.
Each private read/registration rechecks database eligibility and expiry. Revocation
clears guest access and revokes associated active tickets; it does not silently
cancel the place or promote someone else.

Failed recipient claims durably consume quotas (5 per invitation/hour and 60
global/hour) even when eligibility is denied. Claim failure returns a committed
generic rejection, rather than raising an exception that rolls back its counter.
GET never verifies credentials, registers a guest or consumes an invitation.

This is a two-proof bearer workflow with **manual independent verification**, not
automatic email ownership verification. A recipient deliberately sharing both
proofs can transfer access. For higher-assurance private events, require reviewed
identity checks at entry or a separately approved recipient-verification service.
Do not advertise links as cryptographically non-transferable.

## Registration, capacity and abuse controls

Account-free registration collects name, email, optional international WhatsApp,
up to 12 reviewed declarative questions and event-specific processing consent.
There are no uploads, payment fields or staff-account side effects. Consent does
not authorize photography or marketing. Questions reuse the existing typed program
contract; arbitrary HTML, scripts and unsafe URLs are not rendered.

Strict trusted-Origin checks, bounded JSON, input validation, honeypot and shared
PostgreSQL quotas protect submission. Limits are 100 registrations/global/hour,
60/event/hour and 3/normalized email/hour. Quotas/idempotency identities are
domain-separated HMACs, not raw contacts. Deployment still needs reviewed edge-level
abuse controls; these application quotas are not a complete denial-of-service defense.

An event row lock atomically selects confirmed versus waitlisted state. Concurrent
registrations cannot exceed capacity. Email identity and idempotency keys are unique.
Unchanged idempotent retries return the original opaque reference/receipt; changed
payloads fail. A duplicate email with a new key receives generic feedback and an
unbound receipt, never the original credential or registration status. Automatic
browser retries and duplicate submit actions are disabled.

Waiting-list promotion is an explicit audited Operations action with a fresh capacity
check. Cancellation releases a place and revokes tickets but never auto-promotes.
Already checked-in participants cannot be cancelled to manufacture an available seat.
Capacity cannot be reduced below confirmed places. Visibility locks after invitations
or registrations; logistics/fee terms lock after registration. Restricted joining-link
rotation remains possible. Rescheduling/refund/bulk participant migration requires
a later reviewed workflow, rather than silently changing issued ticket terms.

Receipt possession alone cannot reveal participant data or membership status.
Operations independently verifies the recipient before releasing/rotating a separate
participant access code (128-bit hash-only credential). A currently verified private
invite session can satisfy this recipient check for its own registration. The
HttpOnly receipt cookie also uses `/events`, SameSite=Strict and 15-minute browser
expiry. Database receipt expiry is event end plus seven days. Rotation invalidates
the previous code. Explicit Clear event access deletes matching cookies and touches
no staff session. Manual corrections/withdrawals require independent recipient
verification and an audited Operations action.

## Payment, tickets and attendance

Paid classification does not request or accept online payment. An authorized staff
member separately records verified physical payment, exact configured XAF amount and
an evidence reference. Append-only checks use a monotonic database sequence to select
the latest decision, including decisions within one transaction. Revocation immediately
blocks entry even if a formerly issued PDF still exists. These records are not a
payment-provider receipt, accounting ledger, invoice or refund system.

Only confirmed eligible physical/hybrid registrations can receive a ticket. Waiting
lists, cancelled registrations, revoked private invitations and uncleared paid entries
are denied. Issuance is explicit and audited. Repeated issuance returns the same active
ticket; explicit reissue requires a reason, retains old history, increments the version
and revokes the previous QR. Checked-in tickets cannot be reissued.

QR format is a versioned ticket UUID plus a domain-separated HMAC. The QR contains
no name, email, phone or private event URL. The database retains its SHA-256 digest,
not the usable QR payload. Manual references and participant references each contain
128 unpredictable bits. All download paths require staff authorization or the
independently verified participant capability. URLs do not contain QR credentials.

The PDF uses the existing original logo bytes, signature blue header, Quicksand with
font fallback, white body, participant/event/timezone/venue/reference/version, black
QR with quiet zone and explicit private/not-invoice labeling. It renders from a stored
issuance snapshot using an isolated deterministic v1 renderer. No existing finalized
quotation bytes or renderer were modified. Issued ticket snapshots/history are exposed
only through narrow functions; there is no generic update endpoint.

The current ticket PDF is deterministically regenerated, not archived as an immutable
stored byte blob. Preserve the v1 renderer/dependency behavior for existing snapshots;
future visual changes need a new template version and review. A signing-key change
fails PDF generation closed on digest mismatch and requires controlled reissue. Do
not rotate the shared signing material casually; production needs a reviewed key
management/versioning and private document-retention strategy.

Camera decoding runs locally with ZXing and never uploads a stream. Scanning only
captures a payload; **Verify ticket** checks eligibility; a separate **Confirm attendance**
POST records entry. Event selection is mandatory. Server/database checks reject wrong
event, expired event window, invalid/revoked/unpaid ticket and revoked private eligibility.
Event and registration locks, eligibility recheck and a unique registration attendance
row provide atomic one-entry behavior. Duplicates report already checked in and create
no second attendance/audit event. Check-in currently opens at the approved start and
ends at the approved end; there is no implicit early-arrival grace period.

The browser regression caught and corrected nullable empty scan-field serialization:
browser validation now preserves empty strings on the wire, so the server can safely
revalidate either QR or manual-reference input. No validation was relaxed.

## Tests and visual verification

- 14 focused event unit/HTTP-adapter/fragment/PDF/QR tests passed. Some HTTP tests use
  injected repositories; they are not represented as real Auth integration.
- 103 business unit tests passed across Services, quotations, delivery, Projects,
  Products, magazine, Opportunities and Events; 78 Auth tests passed (181 combined).
- Fresh network-isolated PostgreSQL 17: all 14 application migrations applied in
  order; 519 pgTAP assertions passed, including 68 event assertions, plus 30 owner
  bootstrap assertions and existing ticket/quota concurrency checks.
- 54 real LOCAL Supabase Auth/JWT/TOTP/database checks passed: AAL1 and forged-JWT
  denial, inactive/unassigned/other-role denial, public/private publication, independent
  eligibility proofs, dedup/idempotency, concurrent capacity, manual waitlist promotion,
  payment revocation, portal proof, issuance/reissue, wrong-event rejection and eight
  concurrent check-ins producing one attendance row.
- 24 real headless Chrome checks passed: public registration and validation, double
  submission prevention, private slug hiding, fragment cleanup, explicit two-proof
  access, HttpOnly cookie scope/deletion, editor separation, scanner manual fallback,
  explicit entry confirmation, duplicate check-in, mobile overflow, privacy headers,
  Origin rejection and absence of sensitive credentials in HTTP request URLs.
- Camera denial was **simulated in the real browser** to exercise fallback. No
  physical phone/camera scan, permission grant or independent device test is claimed.
- Synthetic one-page and two-page PDFs were rendered with Poppler and every page
  visually inspected. Logo proportions, blue header, normal/long text wrapping,
  page breaks, privacy labels and references were checked. An independent ZXing
  decoder successfully read the QR from both rasterized PDF samples.
- TypeScript, ESLint and production build passed. Local fixture cleanup verified
  zero Auth users, profiles, assignments, events, registrations, tickets and attendance.
  Prior development data remains intact; no active development database was reset.
  A scan of all 38 generated browser artifacts found no configured privileged
  credential values. Final local smoke checks passed: public/generic access pages
  load, unknown catalog lookup is 404 and anonymous staff API access is 403. Next.js
  may stream an HTTP 200 before its generic not-found page renders under the loading
  boundary; this is not evidence that a guessed private event exists. No private
  event title or metadata is returned for that slug.

Commands: `npm run test:events`, `npm run test:events:local`, `npm run test:db:fresh`,
`npm run test:auth`, `npm run typecheck`, `npm run lint`, `npm run build`.
Run active-local fixture suites serially. Event integration requires the local
business server, Docker/local Supabase and installed Chrome or Edge. The fresh-PG17
suite is disposable and preserves the active database. Test artifacts live only in
Git-ignored `.supabase/event-tests` and `.supabase/browser-tests`; samples are synthetic,
with no live ticket entitlement. No credentials are written into reports or test logs.

## Changed files and local review

New implementation is under `src/features/events/`: model/validation, cryptography,
private ingress, caller repository, HTTP adapters, fragment handoff, public views,
registration/guest forms, editorial/Operations forms/workspace, scanner and PDF renderer.
New pages/API handlers are under `src/app/events`, `src/app/api/events`,
`src/app/api/event-registrations`, `src/app/internal/events` and
`src/app/internal/events-api`.
New tests: `supabase/tests/events.test.sql`, `events.test.ts`,
`scripts/test-local-events-integration.ts`, `scripts/test-events-browser.mjs` and
`scripts/decode-test-qr.mjs`. Package/lockfile add pinned QR encoder/decoder dependencies.
Shared navigation, root fragment bootstrap/privacy headers, fresh-database runner,
local browser leak detector and local permission-count/bootstrap expectations were
updated. Existing deployed migrations and authentication flows were not edited.

Review `http://localhost:3022/events`, `/events/private`, `/events/ticket`,
`/internal/events` and `/internal/events/check-in`. The persistent catalog is empty
by design. Staff pages require an authorized LOCAL test identity with verified AAL2;
no permanent demonstration/founder identity was retained. The local integration script
temporarily creates disposable synthetic records, exercises these routes and removes
its own fixtures. No actual event details should be invented to populate screenshots.

## Remaining limitations and next review

1. Test a physical mobile camera over a reviewed HTTPS staging origin before event
   use. There is no offline mode; connectivity is required for eligibility/check-in.
2. Scanner authorization is currently scoped to the explicitly authorized Owner/Operations
   roles across managed events. Volunteer or event-specific delegation needs a separate
   least-privilege design; do not broadly grant these permissions to check-in helpers.
3. A copied valid QR can be presented by someone else; first confirmed entry wins.
   Define proportionate identity-at-entry rules for the event. No QR proves identity.
4. Manual private-recipient and portal-code release needs an approved operational
   verification procedure. No email or WhatsApp delivery was implemented or executed.
5. Public uploads and private poster uploads stay disabled. Only reviewed approved
   public asset references are supported. No invented posters, speakers or meeting links.
6. Questions currently use a validated JSON editor, not a visual form builder. Attendee
   management is intentionally simple, with explicit promotion and no bulk exports,
   automated mailings, delegated scanner accounts or payment integration.
7. Establish event privacy/retention, minors/consent, accessibility, cancellation/refund
   and photo-consent policies before real collection. Preserve audit records and avoid
   deleting shared quota counters during operational cleanup.
8. Fragment credentials avoid HTTP request URLs, but browser extensions, screen capture,
   manual copying, deliberate sharing and compromised endpoints remain risks. Configure
   production telemetry/traces to exclude secrets and private request bodies. Do not
   claim framework-wide logging elimination from these local tests.

Recommended next stage: review the complete Events workflow and perform controlled
physical-device scanning plus accessibility/privacy acceptance testing on synthetic
data, before approving deployment or any real event/invitation. Stage 4F.1 stops here.
