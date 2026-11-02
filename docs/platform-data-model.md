# Platform data and security model

Proposed logical model for [Stage 4A.0](./platform-specification.md), not executable
DDL. No schema, table, policy or bucket is created by this document. Final SQL
types, indexes and RLS require a new local implementation review.

## Boundaries and common rules

Preserve Supabase auth.users and the existing team_profiles, roles, permissions,
role_permissions, team_role_assignments, audit_logs, app_private.auth_flow_tickets
and app_private.auth_recovery_buckets. Do not store business contact information
in Auth user metadata or create Auth users for public submissions.

Specified default: canonical business records live in a new non-exposed private
business schema, with narrowly reviewed caller-aware interfaces for staff. Safe
published projections live in public and are readable anonymously only when
eligible. This keeps enquiry data physically distinct from public catalog fields.
The exact schema/interface approach must be settled in Stage 4A.1: ordinary
caller operations must retain effective RLS/permission/AAL2 enforcement, and
definer interfaces must not become a generic service-role bypass. Do not expose
app_private merely to reach business records. An alternative public schema with
strict RLS is acceptable only after explicit review of grants and projections.

Use UUID primary keys, UTC timestamptz creation/update timestamps, optimistic
version numbers on concurrent staff edits, actor references where meaningful,
explicit finite states and typed foreign keys. Use date-only types for preferred
deadlines and preserve venue timezone for event/program schedules. All scheduled
publication/window comparisons use server time. Slugs are unique within module;
changes retain safe redirects without exposing drafts or private targets.

Money is integer minor units plus explicit ISO currency and configured precision,
never binary floating-point. A missing amount is distinct from zero. Fee/budget
and quotation currency need owner approval; do not assume XAF or exchange rates.
Use a deterministic non-negative rounding rule for quotation totals and retain
rendered revision snapshots. Financial/tax terms are company-configured content,
not an automated accounting system or legal determination.

Validate lengths, allowed enums, non-negative quantities/amounts/capacity and
schedule ordering at database and server boundaries. Index foreign keys, stable
references/slugs, status+creation queues, schedules and outbox due times. Do not
automatically hard-delete operational history when catalog items are removed.
Retire catalog records; restrict deletion of referenced resources. Audit actors
may become null on account deletion while action/resource history survives.

## Content and public presentation

- **team_professional_details**: team_profile ID, professional title, approved
  internal biography. Optional public biography/media is separately published;
  no private email, security role mapping or factor metadata in public profiles.
- **content_items / content_revisions**: ID, kind (article, company_story, what_if,
  community_update, announcement), slug, title, excerpt, sanitized structured body,
  byline reference/display snapshot, cover asset, draft revision, published revision,
  schedule and lifecycle. Revision history is internal. Public projection includes
  only the published version and approved social metadata.
- **campaigns**: title/copy, image, CTA, ranking, schedule and publication state.
  Target uses nullable product_id/event_id/opportunity_id/content_item_id with
  exactly one target or an explicitly validated standalone announcement destination.
  Do not rely on an unconstrained polymorphic UUID. A CTA target is validated
  against approved routes/origins and current visibility, not arbitrary HTML.
- **public_assets**: private source/approved public derivative references, media
  type, dimensions, alt text, usage rights/consent evidence reference and publisher.
  Public derivatives strip sensitive EXIF; original applicant/client files never
  become public assets by changing a flag.
- **public_* projections**: safe catalog/article/event fields with published revision
  and source/version references. Never include internal notes, draft text, private
  venue/joining access, contacts, budgets submitted by clients or Storage secrets.
  Read logic must exclude withdrawn/expired/private items even if cache is stale.

## Services, enquiries and quotations

- **services**: slug, title, description/deliverables, media, order and lifecycle.
  No starting-price field in the public projection. Retired services stop taking
  new requests but remain linked to historical requests.
- **service_budget_options**: service FK, label, currency, optional min/max amounts,
  sort order and active state; include a reviewed “not sure” option. Options must
  belong to the selected service; inactive options cannot be submitted. They
  represent the client's estimate, not a binding quotation.
- **quote_requests**: UUID, opaque unique public reference, service FK and service
  snapshot, submitted contact/name/description, deadline preference, selected budget
  ID+snapshot, state, handling owner and submission/consent/idempotency references.
  Request notes and triage are private. FK validation prevents selecting an option
  from a different service. Reference collisions are retried internally before
  receipt; references cannot enumerate/read other requests.
- **client_contacts**: request FK, name, normalized email and WhatsApp, verification
  method/time/evidence reference, validity status and version. Valid syntax does
  not mean verified ownership. Changed contact information needs re-verification;
  it cannot silently overwrite a recipient for already approved progress sends.
- **contact_enquiries**: reference, contact snapshot, category (general/community
  versus business), message, status and handling scope. Business inquiries can
  link to a quote request after deliberate conversion, preserving the original.
- **enquiry_referrals / technical_assessments**: typed source FK (request,
  application or enquiry), exactly one source, releasing actor, target workspace,
  explicit shared field/document scope, reason and review state. Release scope
  changes are audited; deletion/reclassification does not preserve unintended access.
- **quotations / quotation_revisions**: request FK, unique quotation number,
  revision number, immutable finalized company/client/scope/pricing/terms snapshot,
  draft/finalized/superseded state, actor/time and private generated artifact FK.
  Child **quotation_lines** hold decimal quantity, unit amounts and totals; server
  computes totals deterministically. Sending references an exact finalized revision,
  not a mutable live document. Changed terms require a new revision.
- **communication_intents / delivery_attempts**: kind, typed source/revision FK,
  authorized actor, channel, recipient/contact-version reference, deduplication key,
  queued/leased/accepted/failed/uncertain state, provider-safe reference and timestamps.
  Generic contacts, quotations and progress mail have distinct command types.
  WhatsApp handoff records user-reported handling separately from provider delivery.

## Products and waitlists

- **products**: slug, approved name/description/media, independent development and
  publication states, tentative/confirmed launch date, CTA and waitlist-enabled flag.
  Meet My Crew content is entered only from approved material. No Merch seed.
- **product_waitlist_entries**: product FK, name, normalized email, optional WhatsApp,
  consent version/time, status and created/updated timestamps. Unique product+email
  prevents duplicates without exposing whether an address already exists. Repeated
  anonymous submissions must not silently replace an existing person's contact/name
  or opt them back in after withdrawal. No global marketing subscription implied.

## Programs and applications

- **opportunities**: type, slug, title, description/eligibility, location/mode,
  timeline, open/close instants, requirements, optional seats, optional fee amount/
  currency, on-site payment notice and editorial/operational states. Fee visibility
  is intentional; it does not authorize online payment collection.
- **application_form_versions**: reviewed declarative field definitions, required
  flags and allowed values. No executable rules, arbitrary query expressions or
  unsupported sensitive-data fields. Freeze version used by each application.
- **program_applications**: opportunity FK, opaque reference, applicant/contact
  snapshot, form-version FK, validated answers, received/under_review/shortlisted/
  accepted/rejected/withdrawn state, decision actor/time and private notes.
  Child **application_reviews** store scoped review outcomes; technical referrals
  expose a selected assessment, not the entire application table.
- **program_enrollments**: application FK unique, accepted slot/status and operational
  notes where capacity is used. Acceptance and slot allocation are atomic. No
  financial ledger or online-payment state is created implicitly.

## Events, tickets and attendance

- **events**: slug, title/public description, visibility, mode, schedule/timezone,
  public venue summary, private joining/venue details, capacity, registration window,
  editorial status and operational status. Private details are separate records or
  separately protected columns/interfaces, not hidden only by the frontend.
- **event_access_invites**: event FK, hashed high-entropy access token, expiry,
  usage limit and revoke state for private registration. Tokens grant only scoped
  event access, never staff authentication. They must not enter ordinary server
  URL logs; use a reviewed fragment/manual-POST approach where applicable.
- **event_registrations**: event FK, reference, attendee details, consent state,
  confirmed/cancelled status, accepted time and submission idempotency key.
  Default one-person registration and one active normalized email per event;
  group bookings/children sharing email need a later reviewed rule. Capacity
  counts confirmed registrations only. No automatic waitlist unless approved.
- **event_tickets**: registration FK unique, random ticket ID, hash of independent
  high-entropy QR token, issued/revoked state, ticket version and private branded
  PDF artifact reference. QR contains opaque token only, no email/session/JWT.
  Secret exists transiently during issuance and inside the protected ticket artifact;
  server validation uses its stored hash. Reissue invalidates the previous version.
- **event_checkins**: unique ticket FK, event FK, checked-in time and authorized
  staff actor. Registration/ticket/event state and scope must match. Atomic unique
  insert prevents duplicate check-in under parallel scans. Corrections/re-entry
  policy is deferred, never a destructive reset of attendance history.
- **event_gallery_items / event_recaps**: event FK, approved public assets, captions,
  photo-publication permission and published revision; private-event recap remains
  private unless explicitly approved for public release.

## Projects and progress

- **projects**: type internal/client, title, safe summary, internal notes, status,
  creator, version and planning dates. Client projects require approved request FK
  and verified client_contact FK whose request matches. Internal projects require
  those client fields null. Multiple projects may link to one approved request
  only after explicit operational decision, not automatic duplicate creation.
- **project_intake_releases**: request FK, approved technical scope/contact reference,
  release actor/time and allowed attachment IDs; this is Kevin's limited intake
  view instead of full request access. Nateu's approval releases this view.
- **project_milestones**: project FK, order, title, internal and client-safe summaries,
  pending/in_progress/completed/excluded state, completion actor/time and version.
  Exclusion reason required; no arbitrary percent field. Derived progress uses
  completed/(pending+in_progress+completed), excludes only audited exclusions.
- **milestone_notification_confirmations**: milestone FK unique for initial completion
  notice, milestone revision snapshot, verified contact-version FK, Kevin/authorized
  actor confirmation and outbox intent FK unique. Client project only. A reopened
  milestone does not silently reset the unique key; correction communication is
  separate and explicit. Nateu receives an internal activity notification.
- **internal_notifications**: target staff workspace/user, safe event kind/resource,
  read state and timestamps. No general task assignments. Contents require current
  recipient permissions, not access retained forever after a role is removed.

## Private files, exports and delivery

Use **documents** with storage object key, size, verified MIME, checksum, owner/source
FK, original safe display filename, quarantine/scanning state, uploader authority
and retention metadata. Private buckets for client/applicant/ticket/quotation
files; public media uses a different publication pipeline. File IDs must be bound
to exactly one valid source; no unconstrained attachment IDs accepted from forms.
Use typed request_documents, application_documents and assessment_document_releases
join entities so foreign keys and authorization are enforceable.

Specified intake limit: up to three files, 10 MiB each, PDF/JPEG/PNG only initially;
confirm before implementation. Verify file signatures and decode limits, not just
extensions/browser MIME. Reject SVG/HTML/executables/archives; scan/quarantine
before staff download, with no “scanner unavailable means clean” fallback.
Do not render submitted PDFs inline in privileged dashboard pages by default.
Document scanning infrastructure is an implementation dependency; form intake may
ship without attachments until it is available, rather than opening public buckets.

Uploads use short-lived, bounded, single-submission reservations and generated
object keys. Finalize binding after validation; garbage-collect expired orphan
reservations without deleting referenced files. Document reads require current
authorization and a short-lived scoped signed download or authenticated stream;
never return permanent bucket URLs. Signed URLs remain bearer secrets until expiry
and revocation limitations must be documented. Audit download/export intent without
logging the signed URL. A file name alone is not an authorization boundary.

**generated_artifacts** store type, exact source/revision snapshot, generation
version, checksum, private object FK and ready/failed state. Request PDF,
quotation PDF and ticket PDF are different types with different permissions.
Render only trusted templates with escaped content; block arbitrary remote URL
fetches, embedded client HTML and metadata that exposes internal IDs/secrets.

## Cross-cutting integrity and retention

- Public submission deduplication: hashed idempotency key, form kind, scoped expiry
  and payload digest; conflicting key reuse is rejected generically. Do not use
  sequential receipts or permit unauthenticated lookup by email/reference.
- Public rate-limit state is durable/shared and **separate from Auth quota tables**.
  Use HMAC-protected contact/network signals only under an explicit trusted-edge
  header policy, minimal retention and fixed action-specific/global budgets.
- Outbox jobs have unique business-event keys, bounded retries/leases and immutable
  source snapshots. Provider timeouts become uncertain, not silently “sent.”
- Audits reuse append-only audit_logs with minimal resource IDs/action/reason/version
  and classified technical metadata; no full enquiry, password, token or document.
  Sensitive state changes and audit insertion commit atomically.
- No public-user Auth identity is needed to own a contact/application. Consent,
  withdrawal and data correction use verified out-of-band requests or future
  narrowly scoped tokens, not a public admin endpoint.
- Retention periods, minors/guardian rules, export/erasure procedure and media
  consent text need owner/legal review before collection. Preserve minimal audit
  history while anonymizing/deleting private payloads under an approved schedule.
  Backups and email/WhatsApp copies have separate retention/access implications.
- Company settings hold non-secret branding, approved contact/WhatsApp, currency,
  terms and form configuration. SMTP/API credentials remain in server secret stores,
  never in a general settings table or frontend-managed field.
