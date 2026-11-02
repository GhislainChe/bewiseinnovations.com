# Stage 4A.0 — official platform specification

Status: implementation specification for review; no business features implemented.
Prepared 31 October 2026. The user's Stage 4A.0 decisions are authoritative.
Stage 3A deployment/founder onboarding is postponed because the OVHcloud VPS is
suspended. Local development may proceed only after approval of subsequent work.
The earlier [staging architecture](./staging-environment-architecture.md) is a
historical proposal, not an approved hosting purchase or deployment instruction.

## Reading order and decision language

1. This document: product scope, public website, dashboard, responsibilities.
2. [Permissions](./platform-permissions.md): current catalog versus proposed grants.
3. [Data model](./platform-data-model.md): entities, relationships and invariants.
4. [Workflows](./platform-workflows.md): transitions, safeguards and acceptance criteria.
5. [Implementation plan](./platform-implementation-plan.md): dependencies, test gates,
   unresolved decisions and the first recommended implementation stage.

**Confirmed** means a business decision supplied by the user. **Specified default**
means a concrete engineering/product proposal in these documents, reviewable before
implementation; it is not an already deployed setting. **Decision required** means
the relevant feature cannot be enabled until the named issue is resolved. All new
entities, URLs and permission codes below are proposed, not existing functionality.

## Vision, audiences and release boundaries

BE WISE INNOVATIONS combines business services, products/innovations, community
and editorial content, and opportunities/training/events. Neither the website nor
the dashboard should dominate the other: visitors discover the ecosystem; staff
operate it through a small, permission-scoped workspace.

Visitors browse and submit forms without creating accounts. There is no public
signup, customer portal, applicant portal or public commenting in the initial
release. Staff require Supabase Auth, verified TOTP/AAL2, an active profile,
assigned database role and the individual required permission. A valid Auth account
alone grants no staff access. Deployment, founder provisioning and live email
sending remain separate approvals, not consequences of implementing these modules.

## Founder responsibilities and display identity

Professional titles describe responsibilities and must not replace security codes.
Store display title/biography separately from role assignment; editing a title
cannot change privileges. No founder email is inferred from a name or title.

| Founder | Professional title | Existing role code | Operational responsibility |
| --- | --- | --- | --- |
| Ndong Ghislain Che | Head of Innovation & Strategy | `platform_owner` | Innovation, product ideas/planning, strategy, UI/UX, brand direction and partnerships; governance of access/configuration |
| Kevin Omgba | Head of Technology & Engineering | `technical_lead` | Engineering, infrastructure, technical assessments, reliability, project records and milestones |
| Nateu Farhel | Head of Operations & Management | `operations_lead` | Client relations, requests, quotations, coordination, logistics, programs and operational reporting |
| Divine Nguemo | Head of Communications & Community | `content_community_lead` | Communications, magazine/editorial, community, announcements, social media and public relations; general/community enquiries |

Founders agree pricing in meetings/calls outside the platform. Nateu prepares,
finalizes and sends the quotation. There is no in-app founder voting, financial
approval chain, task board, assignment scheduler or general-purpose collaboration
suite. Referral of an enquiry is routing, not an entitlement to all confidential data.

## Public information architecture

Proposed routes: `/`, `/services`, `/services/[slug]`, `/request-a-quote`,
`/products`, `/products/[slug]`, `/inside-bewise`, `/inside-bewise/[slug]`,
`/opportunities`, `/opportunities/[slug]`, `/events`, `/events/[slug]`, `/contact`.
Existing `/auth/*` routes remain intact. Canonical company domain is
`bewiseinnovation.com` (singular innovation), professional inbox
`contact@bewiseinnovation.com`. Do not substitute a different spelling in links.

### Homepage and campaign hero

Order: featured campaign hero, company introduction, services, products,
opportunities, recent Inside BE WISE stories, contact. Events can be featured in
the campaign and relevant opportunities/events links without displacing this order.

Campaigns may feature a product, event, internship/opportunity or standalone
announcement. Authorized editorial staff create and select them. Specified
default: one deterministic active hero at a time, manually ranked within optional
start/end scheduling; ties use explicit priority then a stable ID. It is not an
automatically rotating carousel. An evergreen company introduction is the fallback
when nothing is eligible. Never expose drafts, expired/private targets or unsafe
external links because they were selected as campaigns. Schedule and target
visibility are checked at read time as well as publication time.

Each campaign has a headline, short copy, accessible image/alt text, CTA label,
approved destination and publication/schedule state. Draft preview is staff-only.
See the workflow document for cache invalidation and publication acceptance.

### Services and Request a Quote

Catalog/detail pages explain value, deliverables and enquiry CTA; **no advertised
starting prices**. Each service may offer its own ordered estimated-budget options,
edited by appropriately authorized administrators. These are the visitor's budget
indication, never a promised price or instant quotation. Currency and “not sure”
handling are explicit; accepted options and labels are snapshotted with submission.

Request form: service, full name, email, WhatsApp contact, project description,
preferred deadline and optional attachments; name/email/WhatsApp/description are
required, budget selection required where a service provides options. Specified
default: deadline may be “not sure”; it is a preference, not a delivery commitment.
Validate these choices with the owner before form implementation.

Store requests privately with a unique, non-sequential public reference and
separate internal UUID. A reference is a receipt, not authorization to fetch a
request. Nateu triages and coordinates technical assessment through narrow access.
Provide a branded **internal Project Request PDF**, distinct from a quotation.
It includes submitted details and a private-attachment inventory, never publicly
accessible document links. Authorized export is audited.

Quotation PDFs contain company/client details, scope, line items or agreed total,
currency, timeline, assumptions, exclusions, validity and chosen commercial terms.
Nateu controls drafts, finalization/revisions and sending after external founder
discussion. Email is a deliberate send action; WhatsApp is initially user-assisted.
No online payment, financial approval engine, invoice/accounting system or
automatic client acceptance portal is included.

### Products and innovations

Catalog/detail pages contain product purpose, media, description, development
status, launch status and available CTA. Development status and publication status
are separate: an announced prototype may be publicly published. Specified statuses:
concept, discovery, prototype, development, pilot, launched, paused, retired.
Launch date may be tentative and must be labelled as such; do not fabricate dates.

**Meet My Crew** is an initial product. Its description/media/status require approved
source material; do not invent capabilities. Waitlist requires name/email and
optional WhatsApp, product-specific consent and a generic success receipt. A
waitlist is not a purchase/reservation guarantee or automatic marketing subscription.
**BE WISE Merch is future consideration only**: no acquisition, catalog activation,
checkout, inventory or launch is authorized by this specification.

### Inside BE WISE

A premium digital magazine for articles, company stories, What If? pieces and
community updates. Support article categories, authors/display bylines, cover/media,
rich-text content, excerpt, publication date and optional related items. Drafts,
revisions and previews stay internal. Published articles get stable slugs, social
metadata and platform share links; no tracking SDK is needed for sharing.

No public comments, community accounts or moderation queue. Sanitize editorial
markup and embeds; authors cannot paste arbitrary scripts. Editorial assets need
rights/attribution and alt text. Retraction produces a deliberate public removal
or correction, with internal history retained.

### Opportunities and programs

Internships, training and other programs have type, description, eligibility,
location/mode, dates/timezone, application window, optional capacity and requirements.
Public application forms collect only program-required information with optional
documents. Default base fields: name, email, optional WhatsApp, short motivation;
program-specific additions require reviewed definitions, not executable form logic.

Staff review applications privately in the dashboard. Nateu coordinates outcomes;
Kevin receives only explicitly referred technical assessment material. Public
program fees may be displayed with currency and a clear **physical on-site payment**
notice. No online payment, card/bank collection or automated fee enforcement.
If acceptance depends on payment, a reviewed manual policy is required first.

### Events

Support public/private visibility, online/physical/hybrid mode, dates/timezone,
venue or restricted joining instructions, registration window and capacity.
Registration gathers minimum attendee details; capacity acceptance is atomic.
Private events require a controlled invitation/access mechanism; an unlisted slug
alone is not security. Private participant lists and online joining details must
never appear in public projections or magazine metadata.

Physical-event confirmations can issue branded tickets with secure QR codes.
Tickets contain no secret-bearing public lookup URL or embedded private contact
payload. Authorized staff scan and check in using authenticated online requests;
one ticket can be checked in once, with duplicate scans clearly reported.
Offline scanning and transferable/group tickets are future scope. Remote mobile
camera testing requires HTTPS and is blocked while deployment is postponed.

Galleries and recaps publish only approved media with usage consent; attendee
registration is not blanket consent to public photos. No event checkout/payment
processing. Any displayed fee, if later approved, follows the on-site policy.

### Contact and referrals

General/community and business enquiry types share a simple public contact form
but have separate private access scopes. Divine handles general/community;
Nateu handles business. Use `contact@bewiseinnovation.com` and a direct WhatsApp
link only after verifying the actual business number; none is invented here.

Default base fields: name, email, category and message, optional WhatsApp.
No attachments in the initial generic contact form. Reclassification/referral
requires an audit and re-evaluates access. Do not silently make a confidential
business conversation visible to Divine when it is routed or summarized.

## Management dashboard

All four founders start at proposed `/internal` **Company Overview** after staff
authorization. Show general activity, published campaigns, aggregate project and
program/event activity, and role-specific next actions. No raw enquiries,
applicant documents, private financial totals or audit payloads in a shared widget.
Aggregation must not disclose private rows indirectly through tiny cohorts.
Zero permissions means denial, not an empty privileged dashboard that leaks data.

Proposed navigation: Overview; Content; Services & Requests; Products; Programs;
Events; Projects; Enquiries; Administration. Hide unavailable entries for usability,
and enforce permissions independently on every route, server operation, query,
download, export and background-command submission.

- Ghislain: strategy/product visibility, brand/content and configuration governance,
  team/access administration and full appropriately audited business access.
- Kevin: project records/milestones, technical assessments explicitly shared with
  him, relevant operational status and technical audit; no broad inquiry/applicant
  list, quotations or participant-contact export.
- Nateu: business requests, quotations, client contacts, program/application and
  event operations, waitlists, coordination and operational reporting.
- Divine: editorial/campaign/product/service/event descriptions, communications
  and general/community enquiries; no quotation/client inquiry inbox, private
  applicant documents or internal audit-log access by default.

All can read approved shared overview information, but a common landing page does
not imply shared confidential workspaces. These assignments require the proposed
permission changes; current roles alone do not yet implement them.

## Project tracking

Kevin creates and maintains internal company projects or approved client projects.
Client projects require an existing approved request and a verified client contact
from it. Staff cannot type an arbitrary email into a progress-send action.
Nateu sees project status and is informed when progress is confirmed; meetings/calls
remain the coordination mechanism, with no task board or work-assignment subsystem.

Projects have description, type, status, owner/contact linkage and ordered
milestones. Completion is calculated, never entered manually: completed included
milestones / total included milestones × 100, equally weighted initially. No
milestones means “not planned,” not a false 100%; exclusions require a reason and
audit. Numeric completion does not automatically close or deliver a project.

Client milestone completion triggers email only when Kevin explicitly confirms
the client-safe completed milestone. Persist that confirmation and a deduplicated
notification intent atomically. Show dispatch state and failed/uncertain sends;
do not claim exactly-once email delivery without provider support. Internal
projects must never generate client mail. Details are in the workflow specification.

## Experience, accessibility and content defaults

Premium, minimalist, Apple-inspired visual direction with a blue brand identity:
generous space, clear hierarchy, restrained motion, high-quality original media
and responsive layouts. This is direction, not copying Apple assets/trade dress
or an approved design. No UI mockups are created in this stage. Define accessible
blue tokens before implementation; never communicate status by color alone.

Target keyboard navigation, visible focus, labelled forms, error summaries,
screen-reader status feedback, contrast, reduced-motion preferences and responsive
phone/tablet/desktop layouts. No autoplay hero, inaccessible QR-only setup or
hover-only controls. English-first is a specified default; French/localization
needs a separate content/translation decision, not invented translations.

Public pages may cache only approved public projections with invalidation on
publication/unpublication. Internal pages and private exports/documents remain
private/no-store. Public SEO is appropriate for published material; auth/internal,
private events, form receipts and previews must not be indexed.

## Initial release versus later work

Initial release scope includes all described core modules, delivered incrementally:
catalogs/editorial/campaigns; quote requests and quotation PDFs; waitlists; general
enquiries; program applications/review; events/registration/capacity/tickets/online
check-in/galleries; shared overview and scoped workspaces; projects/milestones and
confirmed progress notifications. “Initial” does not mean implement all at once.

Future-only: public accounts, comments, online payments/e-commerce, BE WISE Merch
launch, automated WhatsApp API sending, CRM/task-board suite, complex financial
approval, client portal, offline scanning, weighted milestone planning, advanced
analytics and multilingual publication. No accidental dependencies on these should
block the core workflows.

## Security foundation and current conflicts

Retain every deployed migration and tested authentication control. All later
schema/permission changes use new reviewed local migrations only. The existing
Auth-store service-role client is exclusively for fixed ticket/quota RPCs, not a
generic business database adapter. Public submissions need new narrow interfaces;
they must not open staff tables or bypass authorization through generic CRUD.

Current business routes/tables/storage/jobs/PDF tooling and dashboard do not exist.
The root is a placeholder, and `src/features/` is reserved. The current proxy
matches `/auth` and `/internal`; future route placement must preserve authorization
and refresh behavior. Broad old documentation/README statements are historical;
current security state comes from the later deployment/testing reports.

The 18 existing permissions do not grant overview, projects, quotations,
applications, scoped contact/referrals or attendance scanning. Divine currently
has no inquiry permission; Kevin has no project permission. Proposed catalog
extensions and RLS policies must be reviewed before implementing those actions.
The existing six restrictive policies protect six identity/RBAC tables; **they do
not automatically protect new business tables or private Storage objects**.

No implementation, migration, hosted inspection/change, account creation, email,
secret read, deployment or authentication modification occurs in Stage 4A.0.
