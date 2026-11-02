# Business workflows and acceptance requirements

Implementation contract for [Stage 4A.0](./platform-specification.md). Transitions
below are proposed defaults. User-approved responsibilities and security boundaries
are mandatory; no flow is implemented or enabled by documenting it.

## Public submission boundary

For requests, contact, waitlists, applications and registrations: render only
published eligible form configuration; verify trusted same-origin POST, schema,
lengths, allowed values, current program/event/service state and a durable abuse
budget. Use accessible honeypot/time checks and provider/CAPTCHA challenges only
as needed; CAPTCHA is supplementary and must not leak private form text.

Ingress is a narrow fixed server command, not anonymous table CRUD or a service
key exposed to clients. Caller cannot set staff actor, lifecycle, price, recipient,
owner, accepted slot, audit action or role. Authenticate staff separately from
anonymous ingress; business records never depend on mutable Auth metadata.
Persist one valid submission/idempotent receipt atomically. Fail closed if the
shared limiter or document quarantine is unavailable. Generic duplicate responses
must not reveal whether an email already exists; validation errors may describe
fields but never another person's record.

Return an opaque receipt/reference without offering private data lookup. Initial
public submission is not verified identity. An automatic receipt email, if later
approved, must be rate-limited to prevent email bombing; it is not the contact
verification prerequisite for client project progress. Local development sends
only to Mailpit/test transport, never real recipients through inherited hosted env.

Acceptance: concurrent duplicate POSTs produce one resource; unauthorized REST
reads return no private rows; closed windows reject new submissions even with an
old open browser tab; file-ID substitution, oversized bodies and malicious markup
fail without partial publicly accessible uploads.

## Editorial publication and homepage

Draft → in_review → published → archived; rejected review returns to draft.
Review is a simple editorial state, not a multi-founder approval engine. An
authorized publisher may review and publish with a recorded revision. Scheduled
publication checks eligibility at execution and read time. Publishing content,
safe public projection, audit and cache-invalidation intent are coordinated so
an old private revision cannot be fetched publicly during a race.

Campaign activation requires campaign-management plus publishing permissions,
approved CTA/media and public eligible target. A transaction checks schedule/rank;
read selection resolves one eligible hero deterministically. Unpublish/private
transition invalidates related projections/caches and campaign eligibility.
Article sharing uses approved canonical public URLs with escaped text; no private
draft preview link enters social metadata.

Acceptance: an unpublished target never appears through hero/cache/share preview;
invalid scheduling/ranking cannot produce a blank broken homepage; editorial
content cannot execute script or load unreviewed external embeds.

## Request → quotation → approved client project

1. Visitor selects service/budget and submits details/optional safe files. Store
   `received` request with option/service snapshots and unique reference.
2. Nateu moves received → triaging → discussing → quoted → approved/declined;
   cancelled/closed are explicit terminal operational outcomes. Reopening requires
   a reason. Spam is quarantined, not forwarded to founders automatically.
3. If technical assessment is needed, Nateu releases selected scope/documents to
   Kevin; no general inquiry permission is added. Founder discussions determine
   pricing outside the application.
4. Nateu creates quotation draft, prepares terms/amounts, previews branded PDF and
   finalizes an immutable revision. Server validates totals; finalized copies
   cannot be silently edited. Further changes make a new revision/supersede old.
5. Nateu confirms recipient and sends the exact revision deliberately. Recipient
   must be verified by a client reply/approved out-of-band evidence or a separately
   implemented secure contact-verification flow; syntax alone is insufficient.
   Record dispatch acceptance/failure/uncertainty, not an unproven delivery claim.
6. For WhatsApp, download the authorized private PDF and open the verified client's
   WhatsApp contact with an optional neutral prefilled message. Operator attaches
   and sends manually, then records handoff. A wa.me link cannot attach a local
   PDF automatically. Do not place private signed document URLs in public links.
7. Nateu records client agreement obtained outside the platform and marks the request
   approved, with agreement reference and verified contact. No payment processing
   or automatic financial approval is implied. Approved does not automatically
   create a project or authorize new unsolicited client emails.
8. Nateu releases the approved project-intake projection; Kevin creates the linked
   client project. Server verifies request approval, exact contact/request relation
   and no unintended duplicate project. No arbitrary recipient entry is allowed.

The internal Project Request PDF remains available under inquiry/export checks
and is labelled internal. It is never the client quotation or a public request URL.
Audit state transitions, private exports, quotation finalization/send and technical
release. File download links are short-lived, not baked into permanent exports.

Acceptance: Content role cannot edit budgets/finalize quotations; Kevin cannot
read full request through project joins; simultaneous finalizations yield one
revision/version winner; sending an edited/outdated draft is blocked; uncertain
delivery is not automatically retried without deduplication/reconciliation.

## General/community versus business enquiries

Route category to Divine or Nateu; allow reviewed spam/manual reclassification.
States: new → in_progress → referred/resolved → archived. A referral stores who
released which scope to which authorized workspace and why. Recipient must already
have the destination capability; referral does not assign roles. Transfer to
business removes Divine's access to the confidential payload; return acknowledgement
contains only safe status/reference. Selected technical assessment is a separate
read scope, not forwarding the entire inbox.

Explicit replies use verified destination/contact and appropriate channel permission;
HTML is escaped and private attachments require separate release. Never use
visitor-provided content as mail headers, SMTP addresses or template code.
Acceptance: changing category closes previous unauthorized access immediately;
forwarding cannot be used to read all business records; direct WhatsApp contact
does not silently import a phone conversation into a company-wide feed.

## Product waitlist

Only published, waitlist-enabled products accept entries. Normalize email for
duplicate detection per product; respond generically to duplicates. Record consent
and source policy version. No marketing blast is authorized by collecting names.
Withdrawal/correction needs independently verified ownership; an attacker cannot
unsubscribe or overwrite another person's record through the public form.

Acceptance: same email can join two products intentionally; subscriber lists are
never exposed to Content merely because Content edits product descriptions;
closing a product waitlist blocks old form submissions without deleting history.

## Program applications

Published/open program → submitted application → review → shortlisted → accepted
or rejected; applicant can request withdrawal. Staff decisions store actor/time
and reason. Fee information is displayed as on-site payment instructions only.
Optional documents are private/scanned before access; no CVs in technical audit.
Technical assessment is explicit and minimal. If seats are limited, acceptance
locks/checks capacity atomically; competing acceptance cannot exceed seats.

Acceptance/outcome emails are deliberate operational sends to verified recipients,
with rate limits and appropriate consent. No auto-rejection, AI ranking, payment
gateway or fee-verification engine. If minors are permitted, require an approved
guardian/privacy policy before collecting their information.

Acceptance: Content can publish description but cannot read applications; Kevin
sees referred technical material only; accepted counts cannot overbook; closed
program cannot accept a fresh application even when public cache is outdated.

## Event registration, ticketing and attendance

1. Publish approved public event description; operational staff open registration.
   Private events require a scoped invitation/access grant in addition to hidden
   discovery. Registration alone never grants staff or access to attendee lists.
2. In a single transaction enforce event/window/access grant, duplicate policy and
   capacity, then insert confirmed registration and ticket-issuance intent. Full
   returns a safe response; no unstated reserve-seat/online-payment process.
3. For physical events, generate a branded ticket with opaque QR and event/time/
   attendee label, private artifact and hash-only token verification record. Ticket
   is event/registration/version bound. Send through approved contact channel;
   token/secret must not enter application logs, analytics or URL query parameters.
4. Scanner UI requires staff Auth/AAL2 plus events.checkin and event scope. Camera
   decodes locally and sends token by POST. Validate event, confirmed registration,
   ticket version/status and token hash, then atomically insert unique check-in.
   Invalid/revoked/wrong-event token is denied without exposing attendee details;
   repeated valid scan shows “already checked in” with minimal operational metadata.
5. Cancel registration revokes ticket atomically and releases capacity under the
   reviewed policy. Never reduce capacity below confirmed registrations without
   an explicit resolution plan. Reissue requires an audited command and revokes
   previous QR version; concurrent scanners cannot produce two valid first entries.
6. Publish galleries/recaps separately after media review and consent. No implicit
   release of private event venue, participants or restricted joining information.

Online-only events need no physical QR ticket by default. Joining instructions
are supplied only through an approved restricted channel. Check-in is online-only
initially; local camera mocks are not proof of real remote HTTPS/mobile behavior.

Acceptance: parallel registrations never exceed capacity; QR guesses leak no
personal data; roleless/AAL1 user cannot scan; duplicate scans yield one check-in;
private event assets and details remain unavailable through public endpoints.

## Projects, milestones and progress notification

Project lifecycle: planned → active → on_hold/completed/cancelled. Kevin maintains
records and ordered milestones. Numeric progress is equal-weighted included
milestone completion rounded to nearest whole percent for display; keep raw counts
as truth. Zero included milestones displays “not planned.” Reopening or excluding
a milestone recalculates percentage with audit; no manual percent override.

Milestone completion and client send confirmation are distinct. Kevin may record
completion without notifying until client-safe wording/contact are reviewed.
When confirmed, lock milestone/project, verify newly completed state, client-project
type, approved request, verified current contact, current actor authority and lack
of prior notice, then atomically record confirmation, audit and unique outbox intent.
Internal projects have no client-contact linkage and cannot enqueue client mail.
Nateu receives a safe in-app project activity notification as part of the intent;
an operational email copy is optional and requires separate configuration.

Worker leases one due intent; verifies current allowed authority/source/recipient
and uses stable provider idempotency if supported. Unique milestone+notification
kind prevents duplicate intents. A timeout after sending becomes **uncertain**.
Reconcile with provider status before retry; without provider idempotency/status,
require manual review rather than claiming exactly-once external delivery.
“Provider accepted” is not inbox delivery or client reading. Hard bounce disables
further sends until contact correction/reverification. A role change, inactive
actor or withdrawn request pauses pending dispatch for fresh authorized review.

Reopening/re-completing does not resend the original notice. Corrections or missed
notifications need a separately reviewed explicit action and audit; adding that
action must not nullify the deduplication key. Branding is trusted company config,
client summary is escaped and internal technical notes never enter email by default.

Acceptance: double clicks and concurrent completion produce one intent; internal
projects produce zero client intents; email substitution/contact-version changes
are rejected; simulated provider ambiguity is surfaced; Nateu can follow progress
without gaining project edit rights or exposing all request data to Kevin.

## Security, failure and operator behavior

State-changing staff operations must validate server identity/AAL2, permission,
row scope, optimistic version and transition prerequisites. DB mutations and audit
must commit or roll back together. Do not call an external email provider inside
a transaction and then assume rollback can unsend mail; use a durable outbox.

Private file/PDF access uses authorization before issuing a bounded URL/stream;
public object keys, references or UUIDs never bypass it. No PII or free-text content
in routine logs. Sensitive audit events record metadata needed to investigate
without duplicating client/applicant payloads. Shared Overview uses safe aggregates,
not raw privileged queries sent to all founders.

Pending configuration or unavailable scanning/store/queue fails closed with a clear
safe operator message. Preserve records/intent states for reconciliation, do not
silently grant roles, widen RLS, reset quotas or retry uncertain sends. No local
integration runner may fall back to hosted Supabase. SMTP/WhatsApp/payment text,
live scanning, domain URLs and founder accounts remain independently approved
operational steps while remote deployment is postponed.
