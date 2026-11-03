# Stage 4G.1 — Contact and enquiries

Implemented locally on 2 November 2026. Hosted Supabase was not contacted or
modified. No founder accounts, real messages, deployment or Auth changes occurred.
Project requests, quotations and existing finalized documents remain separate.

## Functional scope and routes

- `/contact`: original company logo, existing Quicksand/blue public shell, approved
  `contact@bewiseinnovation.com`, optional approved WhatsApp/social configuration,
  a dedicated Request a Quote link and an accessible account-free contact form.
- `/api/enquiries`: fixed anonymous-submission POST only. No public enquiry lookup,
  private record GET, file upload, subscription, email sender or account creation.
- `/internal/enquiries`: AAL2-protected departmental inbox and assessment workspace.
- `/internal/enquiries-api`: private no-store staff lists/details/actions. POST
  mutations require strict trusted-Origin validation. No generic privileged proxy.

The form collects name, normalized email, optional international WhatsApp, one of
six categories and a message (10–8,000 characters). Explicit processing consent,
a honeypot, bounded JSON and strict field validation apply. No numbers, social
accounts, locations or office hours are invented. There are no attachments.

Existing local runtime safeguards remain mandatory. Run `npm run dev:business`
for `http://localhost:3022`, using the existing private `.env.integration.local`.
The launcher checks local Supabase at `http://127.0.0.1:65421`, suppresses request
output and leaves production recovery disabled. No environment file was changed.

## Configuration without invented contact details

Until approval, the page displays the company email and states that an official
WhatsApp number will appear once approved. It displays no placeholder social links.
Server configuration supports:

- `CONTACT_BUSINESS_WHATSAPP`: approved full international number, including `+`.
  Invalid values remain unpublished. The public link is a normalized `https://wa.me/`
  action with no private text in its initial URL.
- `CONTACT_SOCIAL_LINKS`: JSON array of approved `{ "label": "…", "url": "…" }`
  entries, maximum six. Only HTTPS URLs on the supported Facebook, Instagram,
  LinkedIn, YouTube or X hosts are accepted; credentials and custom ports are rejected.

These are optional server settings, not secrets, and were **not set automatically**.
Approval of the actual business number and ownership of social accounts remain
required. Unsupported networks require a reviewed allowlist change.

## Routing and access boundaries

Initial routing is a departmental suggestion, not an assignment to an invented
founder account:

- General Enquiry, Community Enquiry, Technical Support and Other → Communications
  & Community (Divine's responsibility).
- Business Partnership and Collaboration Proposal → Operations & Management
  (Nateu's responsibility).

An authorized active member of the assigned department may read/manage that enquiry.
The Platform Owner has reviewed oversight across departments. Department membership
comes from database role assignments, never submitted fields, profile titles or
client-supplied claims. If no founder account exists, routing still works without
creating one. This stage deliberately preserves zero permanent staff identities.

The existing `inquiries.read/manage` permissions also grant access to **client
project requests**. They were not granted to Divine or Kevin. Three separate
permissions were added:

- `enquiries.read` and `enquiries.manage`: explicitly mapped to Platform Owner,
  Operations and Communications; database department checks further restrict rows.
- `enquiries.assess`: explicitly mapped to Platform Owner and Technology, exposing
  only active technical briefs and their assessment responses.

The local cumulative baseline is 4 roles, 37 permissions and 73 mappings. Existing
role identifiers and historical deployed migrations are unchanged. Owner bootstrap
permission expectations and local regression baselines were updated; no bootstrap
was executed against hosted Supabase or a founder identity.

## Full handling transfers versus technical referrals

There are two explicit, audited operations:

1. **Transfer handling department** between Communications and Operations. This
   transfers the full enquiry/history to the receiving department. The previous
   department immediately loses access. The UI explains this before submission.
2. **Share limited technical brief**. The handler writes a reviewed, minimal brief,
   without automatically copying any original message, contact or private note.
   Technology sees only the brief and its assessment responses. It cannot open
   the original enquiry by UUID, browse the inbox, change enquiry status, send a
   reply to the client or route the original record. The handler can revoke access;
   revoked briefs disappear from Technology's view and reject further responses.

Only one active technical referral may exist per enquiry. Responses have optimistic
versions, operation idempotency, durable history and audit records. Historic briefs
and responses remain visible to the authorized handler after revocation. This is a
bounded assessment workflow, not a general chat/task-management system.

Manual brief review is a real privacy responsibility: no automatic redaction is
claimed. A handler must remove unnecessary client identifiers and private details.
Server projections cannot prevent an authorized person deliberately typing private
information into a brief. Revocation prevents future reads, not copies already made.

## Intake, abuse and idempotency

The server-only ingress key is fixed to the local `submit_contact_enquiry` RPC.
It cannot fetch tables, call staff workflow functions or follow redirects to another
host. Raw contacts and request bodies are not logged. Ordinary roles cannot execute
the privileged intake function or perform direct private-table CRUD.

Opaque `BWEQ-` references carry 128 unpredictable bits derived from an HMAC of the
submission UUID. Idempotency, payload, duplicate and quota keys are domain-separated
HMACs. The initial accepted UUID returns the same reference on unchanged retries;
changed payloads on that accepted key are rejected. The browser holds the key and
payload only in memory, blocks repeated clicks and performs no automatic retries.

Identical normalized submissions within 24 hours are suppressed even with a new
UUID. Generic duplicate feedback returns the current attempt's reference, not an
existing person's original reference or private status. Visitors are told to retain
their original receipt if they submitted previously. Suppressed duplicate attempts
do not create another enquiry. Different messages are not silently merged into one
conversation or treated as a CRM identity.

Shared PostgreSQL quotas limit accepted submission attempts to 100 globally/hour
and 3 per normalized email/hour across processes. A transaction-level lock serializes
dedup/idempotency decisions. Storage/limiter failure rejects the submission rather
than bypassing controls. Invalid payloads do not create enquiries. Before public
deployment, review edge-level abuse controls/CAPTCHA and quota sizing; per-email and
global quotas alone are not complete denial-of-service protection or email ownership
verification. Forwarded IP headers are not trusted as identity.

## Staff workflow, communication and audit

The inbox lists only authorized records, with reference search (exact opaque
reference), status filtering, newest-first ordering and a 100-row bound. It is not
a full-text CRM search or unlimited export. Details show contact, category, original
message, status, department, private follow-up history and referral history.

Supported statuses are New, In Progress, Awaiting Response, Resolved and Closed.
New can move to In Progress/Closed; In Progress can move to Awaiting Response,
Resolved or Closed; Awaiting Response can return to In Progress or resolve/close;
Resolved can close or reopen to In Progress; Closed can reopen to In Progress.
Transitions require a note, matching version and a new operation UUID. Stale changes
fail closed. Notes, status changes, routing, referral/revocation, assessments and
manual follow-up records are transactional and audited. Audit metadata excludes
message/contact bodies; the detailed history remains in private tables.

Authorized handlers can edit prepared reply text, copy email/phone/text, open an
encoded email draft or a WhatsApp-assisted reply. Optional phone absence hides the
WhatsApp action. Email addresses are described as **submitted**, not independently
verified. Review the recipient and remove confidential information before opening
external applications. WhatsApp receives the prepared text when its link is opened;
no background sending or provider integration exists.

Opening either application does not change enquiry state or record dispatch.
Manual Email/WhatsApp records require explicit staff attestation in the UI and a
private note; they mean staff-confirmed dispatch, not provider delivery/read receipts.
Follow-up-needed can be recorded without pretending a message was delivered. Matching
operation UUIDs prevent accidental duplicate confirmations; conflicting reuse fails.

## Local storage and security implementation

New local migration: `20261102060000_contact_enquiries.sql`.

Four new `business_private` tables: `contact_enquiries`, `enquiry_referrals`,
`enquiry_activity`, `enquiry_buckets`. Private data has no ordinary table grants;
all four tables have RLS and restrictive MFA policies. Narrow SECURITY DEFINER
functions use empty search paths and repeat AAL2/permission/department checks.
The server additionally uses the existing verified Auth gateway, active profile,
assigned role and exact permission checks. Genuine caller sessions perform staff
operations; the privileged intake credential is not used for staff decisions.
Private activity/referral rows cannot be fetched directly by guessing IDs.

No public page or receipt exposes enquiry records. React renders all text safely;
there is no arbitrary HTML, embed, attachment or rich-text execution. Reply links
encode their fixed subject and user-reviewed body and validate recipient formats.
Private HTTP responses use existing no-store/no-referrer document headers. Browser
bundles import no privileged client or secret. Existing Auth/MFA routes are unchanged.

## Validation results

- 8 focused unit/HTTP-adapter tests passed: normalization, authority injection,
  consent/honeypot, initial routing, safe optional configuration, strict actions,
  reply URLs, Origin rejection before ingress construction and safe failures.
  HTTP-adapter tests inject repositories and are explicitly **not** real Auth tests.
- 111 business unit tests and 78 authentication tests passed (189 combined).
- 37 focused pgTAP enquiry assertions passed: grant boundaries, intake/dedup,
  AAL1/unassigned/inactive denial, department isolation, original-request separation,
  scoped referral content, assessment, revocation, transfers, concurrency versions,
  manual dispatch idempotency and audit retention.
- Fresh disposable network-isolated PostgreSQL 17 applied all 15 application
  migrations in order and passed 556 pgTAP assertions, 30 owner-bootstrap assertions
  and the existing Auth ticket/quota concurrency suite. Active development data
  was not reset. The fresh suite initially found an outdated Operations expected
  permission list; the expectation was corrected to the explicitly reviewed grants.
- 36 genuine LOCAL Supabase Auth/JWT/TOTP/database checks passed: AAL1 and forged
  AAL2 JWT rejection, inactive/unassigned denial, no project-request grant to Divine,
  fixed intake, distributed quota/dedup, concurrent status edit with one winner,
  exact operation retry, limited brief, response/revocation, full department transfer
  and single manual-dispatch history/audit entry.
- 16 real headless Chrome checks passed: anonymous staff denial, public form and
  validation, double-submit prevention, no browser persistent storage, mobile
  overflow, Communications inbox, safe email preparation, missing-phone behavior,
  limited technical brief/response, unrelated departmental hiding and bad Origin.
  No external email/WhatsApp action was clicked or message sent.
- TypeScript, ESLint and production build passed.

Run `npm run test:enquiries`, `npm run test:enquiries:local` and
`npm run test:db:fresh`. The integration suite requires the local business server,
local Docker/Supabase and installed Chrome/Edge. Run active-local integration suites
serially. Fixtures are synthetic, tracked to their exact generated names/actors,
and removed afterward; unrelated audit history and shared quota state are preserved.

## Files and review instructions

New feature files under `src/features/enquiries`: `model.ts`, `config.ts`,
`ingress.ts`, `server.ts`, `http.ts`, `public.tsx`, `staff.tsx`, `enquiries.test.ts`.
New route files under `src/app/contact`, `src/app/api/enquiries`,
`src/app/internal/enquiries`, `src/app/internal/enquiries-api`.
New database test `supabase/tests/enquiries.test.sql` and real integration/browser
scripts `scripts/test-local-enquiries-integration.ts`, `scripts/test-enquiries-browser.mjs`.
Existing public/staff navigation, package test commands, local permission-count
expectations, fresh replay list and owner-bootstrap guard were updated. Prior
business work and historical migration files were preserved.

Review `http://localhost:3022/contact` and `http://localhost:3022/internal/enquiries`.
The latter requires an authorized LOCAL identity with verified AAL2. No permanent
demo/founder account is retained; the integration suite creates/removes disposable
local identities to test the workflow. No real enquiries were seeded.

## Remaining limitations and next stage

Confirm the official business WhatsApp number and owned social accounts before
configuring them. Actual email/WhatsApp delivery remains manual and untested in
this stage. No automatic confirmation email, subscriber marketing, attachments,
bulk exports, full CRM, inbox notifications or chat system is implemented.

Before collecting real data, approve a retention/deletion schedule, correction and
withdrawal verification process, referral minimization guidance, departmental handling
procedure and deployment abuse/telemetry controls. A request reference is not proof
of identity; verify the original contact before disclosure/correction/erasure. This
stage provides contact instructions, not an unauthenticated deletion endpoint.

Recommended next stage: review the complete local contact-to-handler workflow,
accessibility and privacy boundaries, then approve the actual public contact details.
Deployment, live messages and founder provisioning remain separate stages.
Stage 4G.1 stops here for review.
