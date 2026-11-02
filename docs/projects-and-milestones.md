# Stage 4B.1 — local projects and milestone tracking

Completed locally on 2 November 2026. Implements the project slice of the [official specification](./platform-specification.md),
[permission matrix](./platform-permissions.md), [data model](./platform-data-model.md)
and [workflows](./platform-workflows.md). This stage follows the user's latest
Projects sequencing; older proposed stage numbers are historical planning labels.
All development, migrations and fixtures remain local. No hosted Supabase call or
change, founder provisioning, invitation, actual email/WhatsApp message, deployment,
Auth/MFA flow change, task board, assignment system or chat is introduced.

## Local review

Use the existing local Docker/Supabase environment. Apply local migrations using
`npx supabase migration up --local`, then `npm run dev:business`. The existing
launcher reads the ignored `.env.integration.local`, rejects hosted Supabase URLs,
binds only local port 3022 and leaves password recovery disabled. Private environment
files are preserved. No permanent demo staff or founder credentials are seeded.

- `http://localhost:3022/internal`: minimal Company Overview, with project-only
  summaries available to all four active staff roles after verified TOTP/AAL2.
- `/internal/projects`: list/detail, progress, milestones and prepared progress
  activity. Technology and Platform Owner can create/edit; Operations can read.
- `/internal/requests`: Operations can approve and release a limited project intake
  after client agreement and independent verification of the existing submitted email.
  The existing services, quotation/PDF and delivery interfaces remain available.

Navigation links appear only where permitted. Every page/API/SQL operation checks
authority independently; hiding a link is not the access control. Roleless, inactive,
anonymous and AAL1 callers remain denied. Unassigned Auth users can still use the
unchanged Auth/MFA enrollment workflow without gaining staff access.

## Client approval and private contact prerequisite

The earlier request lifecycle did not include approval or verified-contact evidence.
The new migration adds `approved` and an atomic Operations release command. From
`discussing`, the operator records the client agreement reference, private evidence
of independent email verification, explicit attestation, and approved technical
scope. This approves the request, increments its version, captures its **existing**
email and records the intake/audits together. An approved request may have its release
reviewed or revoked with optimistic versions. Ordinary status updates cannot set
`approved`; that state requires the evidence-bound command. Approved requests may
subsequently be declined/cancelled/closed through the existing operational workflow.

This is an auditable trusted-operator verification record, not automated proof of
mailbox ownership. Evidence should reference a verified client reply or approved
out-of-band confirmation; do not paste passwords, tokens or excessive correspondence.
Pricing and client agreement still happen outside the platform. A finalized PDF,
submitted email syntax or a MANUALLY_SENT record alone does not approve a project.

Kevin sees only the released request reference and approved scope, not contacts,
verification evidence, original enquiry text, budget, quotations or attachments.
Creation verifies request approval, active release, current request version and
exact contact match. One client project per request is enforced by a unique FK;
multiple projects for one request need a later explicit operational design.
Project type/request linkage cannot be changed after creation. No project/notification
command accepts an arbitrary email address or client-supplied assurance claim.

Changing request status/contact/version or revoking its release blocks new notification
preparation. Re-verification creates a new release version. Existing prepared intents
retain their captured contact version; a future sender must reject stale/revoked
authorization rather than silently retarget an old intent. Technical project history
is retained when a release is revoked; contacts remain private.

## Project and milestone behavior

Internal projects have no request/contact link. Project fields are name, description,
planned start/end dates and explicit status: planned, active, on_hold, completed or
cancelled. Dates are validated and an end date cannot precede its start. Business
status is explicitly maintained; progress does not automatically close a project.

Milestones have ordered title, internal notes, separate client-safe summary and
pending/in_progress/completed/excluded state. Exclusion requires a reason. Authorized
staff can add/edit, move up/down, mark complete or reopen. Up to 100 milestones per
project are supported; there is no task-assignee field or coordination board.

Progress is computed in PostgreSQL from raw counts: completed / included milestones,
equal weights, rounded to the nearest whole percentage. Excluded milestones are
removed from the denominator. Zero included milestones displays **Not planned**,
never a fabricated 100%. Reopening/exclusion/order changes are audited. The bar
describes milestone completion, not an independent estimate of engineering effort.

All project/milestone/order/confirmation operations serialize on the project row
and use its optimistic version, preventing lost concurrent changes. Milestones
also carry their own versions/completion actor/time. Reorder requires the complete
exact set of this project's milestone IDs with no substitutions or duplicates.
There is no hard-delete UI; records/history are preserved.

## Shared visibility and notification preparation

Company Overview is a dedicated SQL projection, not frontend filtering of private
payloads. Client projects are labeled **Client project** and show only project ID,
type, status and progress counts. Private client project names/descriptions, request
IDs/references, contacts, intake evidence, notes, prices and quotation data are omitted.
Internal project names are shared company metadata; avoid putting private client
details into an internal-project name. Detailed project access is limited to Owner,
Technology and Operations. Communications has summary access only.

Marking a milestone complete does **not** automatically notify a client. Kevin (or
the authorized Owner fallback) reviews the separately saved client-safe wording
and explicitly confirms it. The database checks current AAL2/role, completed state,
client type, non-cancelled project, current approval/contact release and version,
then creates one PREPARED email intent and audit atomically. The intent snapshots
only reviewed client copy, verified contact/version, milestone version and progress
counts. A unique milestone key prevents duplicate initial notifications, including
concurrent confirmations and reopening/re-completing the milestone. Corrections or
repeat messages require a future separately reviewed workflow, not resetting that key.

Operations sees the progress activity on the project list/detail, including prepared
update count, client-safe copy, percentage and time. This is the minimal in-app
coordination signal for Nateu, not email, a push notification or a task assignment.
Current permissions govern this view on every request. Internal projects can never
create client notification intents.

Email preparation uses the approved palette, original logo CID strategy and tagline,
with escaped client-safe text, percent and a milestone/effort disclaimer. Internal
notes and milestone titles are not automatically copied into email. There is no
sender, SMTP credential, background worker, automatic retry, provider receipt or
public document link. PREPARED means **nothing has been sent**. The private outbox
recipient is not returned to Technology/Communications or ordinary browser previews.
Any future transport needs a trusted server worker, original inline-logo MIME part,
current actor/source/contact revalidation, safe leases/idempotency, throttling and
uncertain-outcome reconciliation; enabling real delivery is outside this stage.

## Migration, permissions and enforcement

New LOCAL migration: `20261102010000_projects_milestones.sql`.
Adds four tables in non-exposed `business_private`:
`project_intakes`, `projects`, `project_milestones`, `project_notification_intents`.
They have RLS, explicit grants, restrictive live AAL2 policies, typed FK relations,
finite states and bounded fields. API roles cannot directly mutate them. Contacts,
verification evidence and raw notification intents have no direct API SELECT grant.
No private schema or bucket is exposed and no historical migration is edited.

New permissions and explicit recipients:

- `company.overview.read`: all four existing roles.
- `projects.read`: platform_owner, technical_lead, operations_lead.
- `projects.manage`: platform_owner, technical_lead.
- `projects.notify`: platform_owner, technical_lead (Kevin primary; Owner fallback).

Local totals become **4 roles, 27 permissions, 52 mappings**. Existing grants remain
intact. Owner/content disposable-binding allowlists and exact-catalog tests reflect
the explicit new grants; no binding/bootstrap was performed against hosted Supabase.
Contact release reuses `inquiries.read` AND `inquiries.manage`, never technical rights.

Ten narrow public RPCs expose caller-aware project/overview/release commands. Their
definer functions have empty search paths, qualified tables and mandatory current
permission/AAL2 checks; anonymous and service-role execution is revoked. Existing
request-status RPC is extended only for approved-state withdrawal transitions.
New tables do not inherit MFA from old tables; their policies are explicit.

`src/features/projects/server.ts` uses the genuine caller SSR client and verified
team gateway. `/internal/projects-api` fails closed outside the fixed local runtime,
enforces strict trusted Origin on all mutations, bounded JSON/exact field validation,
and private no-store/no-referrer/noindex headers. No Auth-store administrative client
is reused for business authorization. UI requests use explicit CORS-mode fetch,
duplicate-click locking and no automatic retries. On ambiguity, reload authoritative
state before another action. New forms use POST-only native fallbacks so project
text cannot leak into a URL if JavaScript is interrupted.

Audits record project/request IDs, actor, action and state metadata without copying
private contacts or free-text client/technical content. Audit failure rolls back the
associated mutation/intent. Email/role changes are never inferred from a display title.

## Validation results and files

Final validation results:

- **7/7** focused project model, input, progress, email escaping and HTTP/Origin
  unit/adapter tests. Existing suites: **32/32** services, **9/9** quotations,
  **9/9** delivery and **78/78** authentication. These are unit/adapter regressions,
  not actual email delivery or physical-authenticator tests.
- **290/290** pgTAP assertions, including **62** new project assertions: role/AAL1/
  inactive/unassigned denial, private projections, valid release/creation, invalid
  linkage, progress/reopening/exclusion, exact ordering, contact drift/revocation,
  deduplication, and project/notification audit-failure rollback. The active local
  suite passed serially without concurrent integration fixtures.
- A fresh network-isolated PostgreSQL 17 instance applied **all ten migrations in
  order**, passed the same **290** assertions, retained **52** mappings on repeat
  baseline seeding, and passed **30/30** canonical owner-bootstrap assertions.
  Existing development data was preserved; the disposable instance was removed.
- **64/64 real local Auth/TOTP/JWT/project RPC checks**, using genuine caller
  sessions: AAL1 denied, verified AAL2, forged JWT rejected HTTP 401, wrong roles/
  inactive/unassigned denied, Operations evidence-bound approval, limited technical
  intake, concurrent client creation (one winner), concurrent notification preparation
  (one intent/audit), source contact isolation and zero internal-client notifications.
- **17/17 actual local Chrome browser checks**: anonymous denial, creation, zero/
  100/50/0 progress states, milestone ordering/reopening, Operations read-only view,
  Communications-safe overview/private-detail denial, explicit notification
  preparation, original logo and 375px mobile layout/labels. This is browser
  functionality using local disposable TOTP sessions, not a physical-device test.
- Existing real integrations: **112/112** local Auth/REST/Storage/HTTP-handler
  checks, **58/58** local role-binding/cleanup transaction assertions, and **47/47**
  actual Edge services/inbox/quotation/delivery regressions.
- Existing Auth-store concurrency remained correct: ticket redemption **1/12**
  winners, email quota **3/12**, global quota **30/33**, as expected.
- TypeScript, zero-warning ESLint and production build passed. All source files
  passed strict UTF-8 validation. **23** production browser artifacts were checked
  against configured private secret values; none were present. Environment files,
  synthetic screenshots and diagnostic artifacts remain Git-ignored.

The runner was corrected to scope percentage checks to the selected project, use
exact numeric progress values, properly quote browser selectors and wait for enabled
controls. Earlier malformed expressions closed the browser before valid API responses;
safe server stage tracing confirmed RPC completion and was then removed from the
application. A Windows edit introduced an invalid UTF-8 character during development;
it was corrected, followed by a clean build/restart and passing inbox regressions.
No temporary application diagnostics remain. Run active-local pgTAP, integration
and browser suites **serially**, since some assert fixture-wide counts. The isolated
fresh-database suite uses its own container.

Final local state: seven approved services, 42 budget options, four roles, 27
permissions and 52 mappings; the pre-existing one request remains. Synthetic Auth
users/profiles/assignments, intake releases, projects, milestones and notification
intents were removed. No permanent test staff, founder, project or contact evidence
was seeded. The development application is running through the existing local-only
launcher on port 3022. A synthetic mobile review screenshot is retained under ignored
`.supabase/browser-tests/projects-mobile.png`.

Created: the new migration and `supabase/tests/projects.test.sql`;
`src/features/projects/{model,email,server,http,workspace,page,intake-panel}.ts/tsx`,
`workspace.module.css`, `projects.test.ts`; routes `src/app/internal/page.tsx`,
`projects/page.tsx`, `projects-api/route.ts`; local integration/browser scripts;
and this report. Updated the staff workspace/navigation/status choices, current
catalog expectations in pgTAP/admin allowlists/fresh tests, npm test commands and
README. Specifically, local catalog expectation updates are in
`supabase/tests/{rbac,services_requests,quotations,delivery}.test.sql`,
`supabase/admin/{bootstrap-platform-owner,bind-disposable-content-test}.sql`,
`scripts/test-fresh-mfa-database.mjs` and `scripts/test-content-role-transactions.mjs`.
The new test runners are `scripts/test-local-projects-integration.ts` and
`scripts/test-projects-browser.mjs`; commands are `npm run test:projects` and
`npm run test:projects:local`. No new environment variables or dependencies are required.
Earlier worktree changes and private environment files were preserved.

## Remaining limitations and next stage

This is the minimal Projects/Overview slice, not a general company dashboard. There
is no automatic engineering-effort estimate, assignment board, calendar scheduling,
project attachments, client portal, real sender, notification read-state/push feature
or correction/resend workflow. No quotation price or document is exposed to Kevin.
Manual contact attestation depends on honest authorized Operations verification.

Before remote use, independently approve migrations, hosting/HTTPS/private configuration,
backup/recovery and staff MFA provisioning. Before real progress email, separately
review recipients, consent/retention, branding MIME rendering, transport configuration,
current authorization checks, provider idempotency/reconciliation and local capture
tests. Existing production password recovery remains disabled.

Recommended next stage: review this local workflow with Operations and Technology,
then specify/test the separately approved notification delivery worker using local
mail capture. Do not start actual delivery or founder onboarding automatically.
