# Platform implementation and approval plan

Companion to the [Stage 4A.0 specification](./platform-specification.md). This is
sequencing and readiness documentation only. Stage 3A deployment and founder
onboarding remain postponed; the suspended VPS is not a reason to use hosted
Supabase for local fixtures, change DNS, purchase hosting or bypass security.

## Existing foundation and compatibility review

Reviewed local App Router structure, package scripts, proxy, auth core/gateway,
all four migration files (RBAC, catalog, flow security, MFA), feature placeholder,
database RBAC documentation, founder provisioning/MFA recovery guidance, prior
hosted permission test and cleanup reports, and the staging proposal.

The implementation foundation is Next.js 16.4.2/React 19.3.1, strict TypeScript,
Tailwind 4, Supabase SSR/Auth/PostgreSQL with versioned migrations. Existing
`src/features/` is reserved; keep domain validation/services/components there,
thin routes in `src/app`, reusable infrastructure in `src/lib`, and SQL tests in
Supabase's local test area. Before Next.js changes read the relevant installed
`node_modules/next/dist/docs/` guides as AGENTS.md requires. No new framework,
microservices suite, public identity provider or task-management product is needed.

Implementation conflicts to resolve explicitly:

1. **Permission coverage:** current 18/31 catalog is correct for the tested identity
   foundation, not complete business authorization. Proposed extensions are in
   platform-permissions.md. Kevin lacks project rights; Divine lacks scoped general
   inbox rights; no founder currently has overview/quotation/application/check-in
   capabilities. Never solve this by treating a title, role name or content flag
   as a broad business-access exception.
2. **New-table protection:** MFA restrictive policies cover six existing RBAC
   tables, not future domain/Storage tables. Every new path needs scoped RLS,
   grants, AAL2, direct-query tests and controlled server mutation checks.
3. **Private schema interfaces:** finalize the proposed private business schema
   and narrow API strategy before DDL. No exposure of app_private and no generic
   definer query/CRUD endpoint. Prove real caller authorization for each interface.
4. **No business infrastructure yet:** private uploads/quarantine/scanning, PDF
   renderer/fonts, durable outbox/worker, delivery provider integration, public
   anti-abuse store and safe projections must be designed, not assumed installed.
5. **No dashboard:** the current `/internal` proxy match is session refresh, not
   proof of a protected route. Shared landing/navigation require a new overview
   permission and sanitized aggregates. `getCurrentTeamMember` correctly rejects
   AAL1/unassigned users; public forms must not weaken that behavior.
6. **Local environment:** `.env.local` may point at the hosted project. Local
   business runners must explicitly select ignored local configuration and reject
   hosted URLs/refs. Do not edit private env values or relink projects implicitly.
7. **Historical documentation:** README and early RBAC documents describe earlier
   snapshots, including now-implemented Auth and formerly pending migrations.
   Use later MFA deployment and cleanup records for the current baseline. Add
   current pointers as work is approved rather than rewriting historical evidence.
8. **Suspended deployment:** local browser/Auth/Mailpit tests prove local behavior,
   not founder remote access, production TLS, physical QR-camera compatibility,
   SMTP delivery from a new deployment or provider rollback. Those remain blocked.

## Recommended first stage — 4A.1 local business foundation

Authorize a narrow **local data-access and permission foundation** before UI or
full modules. Deliverables for that later stage:

- Confirm specification decisions needed for the first service/request slice.
- Select schema/API pattern, define permission additions and domain-specific
  grants with an explicit old-versus-new mapping review. Add versioned LOCAL
  migrations only; never edit deployed history or push remotely.
- Establish minimal shared domain validation, structured safe error handling,
  action/audit contract and isolated local fixture/test helpers.
- Prove representative public-published read, anonymous private-data denial,
  AAL1 denial, active AAL2 permission grant, wrong-role denial and scoped technical
  assessment using genuine local sessions and direct database/API checks.
- Keep Auth ticket/quota modules unchanged and fixed-purpose. Establish a separate
  public-ingress rate-limit abstraction and outbox contract without sending mail.
- Do not create founder accounts, bulk business schemas prematurely or build the
  homepage/dashboard in this foundation stage. Disposable local fixtures only.

Exit gate: approved field/permission/interface decisions; existing security tests
still pass; new negative RLS tests pass; clean local fresh-migration sequence;
TypeScript/lint/build pass; no hosted diff or real email. The next user approval
should name this scope rather than authorize all platform work at once.

## Incremental delivery sequence

Each stage is separately reviewable and must end with tested acceptance criteria.
Identifiers below are proposed planning labels, not authorization to execute them.

| Stage | Local deliverable | Depends on / exit evidence |
| --- | --- | --- |
| 4A.1 | Permissions, data-access boundaries and test foundation above | Reviewed specification; real local authorization matrix |
| 4B.1 | Shared Overview shell, founder display titles, accessible design tokens/navigation | company.overview.read, safe aggregates and staff route denial; no founder accounts needed |
| 4B.2 | Editorial/catalog primitives, services and budget option management | Publication/private draft tests; operations-only budget changes; accessible minimal UI |
| 4B.3 | Quote request intake, general/business contact routing, private upload pipeline | Durable abuse controls, quarantine/scanning dependency, idempotency, reference and referral isolation |
| 4B.4 | Request PDF, quotation revision/PDF and deliberate dispatch/handoff | Currency/terms/contact verification, trusted renderer, private exports, outbox and Mailpit; no financial approval engine |
| 4C.1 | Products/Meet My Crew and product-specific waitlists | Approved product material; duplicate/consent/privacy tests; no Merch launch |
| 4C.2 | Inside BE WISE publishing, announcements and campaign hero | Sanitized revisions, rights/alt text, scheduling/publication/cache correctness and deterministic hero |
| 4D.1 | Opportunities, configurable reviewed forms, applications and assessment referrals | Applicant privacy/retention/minors decisions; window/capacity and document-scope tests |
| 4D.2 | Public/private events, registration, tickets and attendance | Private access design, capacity concurrency, QR hash validation and local online-scanner tests |
| 4D.3 | Event galleries/recaps and publication consent | Safe media derivatives, rights workflow and private-event non-disclosure |
| 4E.1 | Internal/approved-client projects, milestones and Nateu status updates | Verified-contact/project-intake release; aggregate progress and scope denial tests |
| 4E.2 | Explicit milestone email confirmation and worker delivery | Durable idempotent intent, ambiguity/retry/bounce tests; internal-project zero-send tests |
| 4F.1 | Balanced public homepage/navigation, responsive polish and release acceptance | All eligible catalogs/projections, performance/accessibility/SEO and privacy review |
| Remote readiness later | Hosting/HTTPS, live disposable tests, founder MFA/provisioning | Separate Stage 3A reactivation, backup/recovery and exact-target approvals |

Small public-page scaffolding may accompany each module locally; polished hero and
homepage composition follow working content rather than fabricated seed copy. No
new live branding/UI work is included in this documentation stage. Operational
records, staff defaults and permissions must not depend on real founders existing
for local testing.

## Feature-independent acceptance gates

- **Security:** real DB/REST/Storage tests for anonymous, unassigned, inactive,
  AAL1, permitted AAL2 and denied AAL2; row-ID substitution; no team self-promotion;
  no broad service-role authorization proof. Audit rollback and technical-log
  privacy tests. Preserve existing authentication/MFA/replay/sign-out tests.
- **Integrity:** concurrent capacity/check-in/outbox tests, exact foreign-key scopes,
  idempotent public forms, optimistic staff edits, immutable quote revisions and
  migration ordering on a fresh disposable local database.
- **Privacy:** private uploads/exports inaccessible directly; scanner outages fail
  closed; no secrets/PII in logs; public projections exclude drafts and joining
  details. Private/sensitive visibility uses uncached eligibility checks; a stale
  public cache cannot serve a newly restricted record. Revalidation failure must
  stop the unsafe transition or remove availability, not quietly leak old content.
- **Communications:** real local Mailpit and genuine local Auth; stub transport
  failures/timeouts; provider idempotency/status reconciliation contract; deliberate
  WhatsApp handoff with no false delivery claim. No hosted SMTP in automated tests.
- **Usability:** keyboard/labels/focus/errors, reduced motion, phone/tablet/desktop
  layouts, visible budgets-as-estimates and on-site-only fee notices; unassigned
  users can finish Auth/MFA without dashboard access.
- **Tooling:** TypeScript, ESLint, production build and relevant unit/pgTAP/local
  integration/browser suites after code changes. Label mocked tests accurately;
  local camera simulation is not a real mobile event check-in pass.

## Decisions and dependencies register

These are not reasons to stop documenting; resolve each before its dependent
implementation. Proposed defaults are concrete review starting points.

| Decision | Specified default / unresolved input | Needed before |
| --- | --- | --- |
| Business data boundary and permission extensions | New private business schema + narrow caller-aware interfaces; scoped matrix proposed | 4A.1 SQL review |
| Currency, budget ranges and quote terms | No currency/ranges invented; company approves options and PDF legal/commercial fields | Budget editor and quotations |
| Contact verification | Recorded client reply/out-of-band evidence initially; automated verification is a separate reviewed flow | Client progress sends and quotation dispatch |
| Branding assets | Blue minimalist direction; exact logo/assets/fonts/blue tokens and public company copy need approval | UI/PDF implementation |
| Meet My Crew facts/status | Initial product approved, capabilities/dates not supplied | Product publication |
| WhatsApp number | No number supplied; verify company-controlled number | Public direct-contact link and handoff |
| Form rules | Request WhatsApp required; preferred deadline can be unknown; program WhatsApp optional | Public form acceptance |
| Documents | 3 files × 10 MiB, PDF/JPEG/PNG proposal; scanner/quarantine service unresolved | Attachments enabled |
| Retention/privacy | Time periods, policy text, marketing opt-in, media rights and possible minors require review | Collecting real submissions |
| Private events | Scoped invitation access; no accounts; one attendee per registration | Private-event implementation |
| Capacity/cancellation | Confirmed entries consume seats; no automatic waitlist, re-entry or group bookings | Event/program operational logic |
| Fees | Physical on-site only; no payment state/financial automation | Programs/event fee messaging |
| Project percentage | Equal weight, completed/included; zero milestones “not planned”; whole-percent display | Project module |
| Notification authority | Kevin primary; proposed owner fallback requires explicit mapping review | projects.notify mapping |
| Delivery worker | Durable outbox; provider idempotency/status capability, scheduling/runtime not selected | Email dispatch implementation |
| Languages | English-first proposal; French translation workflow not yet approved | Content schema/URL planning |
| Remote operations | VPS/hosting availability, physical backup factor, custodians and emergency governance unresolved | Founder activation and launch |

Keep recovery disabled and existing founder approval gates. Independent-device
and backup-factor requirements are not satisfied by a single KeePassXC functional
test. No role-positive local test authorizes live founder binding later.

## MVP release boundary and rollback

The complete initial business release comprises the core modules in the master
specification; sequence stages do not silently drop opportunities/events/projects.
Earlier narrow releases may be approved with unavailable modules hidden and no
misleading launch claims. No public comments/accounts, payment processing, Merch
launch, task board, automated financial approval, WhatsApp API automation or offline
QR scanning enters MVP by implication.

Use additive local migrations, feature flags/configuration for incomplete modules,
sanitized disposable fixtures and explicit test cleanup. Do not use rollback to
remove MFA/RLS, reset remote history or unsend emails. Preserve quotations,
application decisions and audits when records are archived. Later remote releases
need approved fresh backup/restore verification, migration previews and a compatible
forward-fix/rollback plan; no automatic remote deploy from local implementation.

## Stage 4A.0 deliverables and verification

Created five linked documentation files: platform-specification.md,
platform-permissions.md, platform-data-model.md, platform-workflows.md and this
implementation plan. Existing authentication code, environment files, migrations,
tests and hosted services are unchanged. Prior validation counts are historical;
no feature/security test is claimed for an unimplemented module. Documentation
links and whitespace are checked separately from application/runtime validation.

Stop for user specification review. Recommended next approval: **Stage 4A.1 —
local business data-access and permission foundation**, with no hosted writes,
emails, founder accounts, deployment or business UI implied.
