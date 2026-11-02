# Platform permission and responsibility specification

Part of [Stage 4A.0](./platform-specification.md). All proposed extensions require
review and new local migration tests; this document grants nobody access.

## Existing baseline — immutable historical migrations

Roles remain `platform_owner`, `technical_lead`, `operations_lead` and
`content_community_lead`. Professional titles are not role codes. The current
four roles, 18 permissions and 31 mappings are exactly:

| Role | Current permission codes |
| --- | --- |
| platform_owner | team.read, team.manage, roles.assign, settings.manage; content.read/create/update/publish; inquiries.read/manage; registrations.read/manage; waitlists.read/manage; audit.read, audit.technical.read; technical.read/manage |
| technical_lead | technical.read, technical.manage, audit.technical.read |
| operations_lead | inquiries.read/manage, registrations.read/manage, waitlists.read/manage |
| content_community_lead | content.read/create/update/publish |

Slash notation lists individual existing codes, not a wildcard grant. Owner has
exactly all current 18; adding a code must not automatically assign it to owner
through a role-name shortcut. New mappings require explicit review/seed changes
in a NEW migration. Never rewrite the deployed seed to conceal a change.

Existing inquiry access for owner/operations remains the business-inbox boundary.
Existing registration and waitlist permissions remain private operational access.
Existing content permissions cover catalog/editorial description management; they
must never imply authority to read applicant documents, change prices/budgets,
send client quotations, reveal registrants or scan attendance.

## Proposed permission catalog additions

Each paired read/manage below denotes two distinct codes. “Manage” permits the
specified record transitions, not permission assignment or arbitrary table writes.
All staff actions require AAL2, active membership and row scope in addition to code.

| Proposed code(s) | Intended scope | Proposed recipients |
| --- | --- | --- |
| company.overview.read | Approved non-confidential overview aggregates | All four roles |
| campaigns.manage | Select/rank/schedule homepage campaigns; publication additionally requires content.publish | Owner, Content |
| services.budgets.manage | Edit service-specific budget dropdown options/currency | Owner, Operations |
| quotations.read / quotations.manage | Read/create/revise/finalize internal quotation PDFs for business requests | Owner, Operations |
| quotations.send | Deliberately dispatch a finalized revision via approved channel | Owner, Operations |
| applications.read / applications.manage | Private opportunity applications/documents and review decisions | Owner, Operations |
| assessments.read / assessments.manage | Only explicitly referred technical assessments and approved minimum supporting data | Owner, Technology |
| contacts.general.read / contacts.general.manage | General/community enquiry inbox, replies and triage | Owner, Content |
| contacts.refer | Controlled transfer/referral without broadening underlying scope | Owner, Operations, Content |
| programs.operations.manage | Application windows, acceptance/capacity and operational settings; not editorial publishing | Owner, Operations |
| events.operations.manage | Capacity, private invitations, joining instructions and operational lifecycle | Owner, Operations |
| events.checkin | Minimal ticket validity/attendee label and attendance check-in; not registrant export | Owner, Operations |
| projects.read | Internal projects and approved client-project operational/technical fields | Owner, Technology, Operations |
| projects.manage | Create/maintain project and milestone records | Owner, Technology |
| projects.notify | Confirm newly completed client milestones and queue progress notifications | Owner, Technology |
| documents.export | Generate/download approved private request/application exports; still requires domain read permission | Owner, Operations |
| communications.general.send | Explicit replies to general/community enquiries | Owner, Content |
| communications.business.send | Explicit operational replies to business enquiries/requests, not quote or milestone dispatch | Owner, Operations |

Owner access is a governance fallback, not a change to day-to-day ownership: Kevin
maintains projects; Nateu finalizes/sends quotations; Divine handles general contacts.
If Kevin must be the sole permitted milestone sender rather than primary operator,
exclude owner from projects.notify in the reviewed mapping. This is a decision
to settle before that stage, not an implicit superuser path.

No new role is needed for these four founders. A future event scanner could receive
a distinct limited role; assigning one is outside scope. Do not lend founder
credentials to volunteers. Shared overview grants do not confer team.read or audit.

## Action matrix and conjunctions

| Operation | Required checks beyond identity/AAL2/profile/role |
| --- | --- |
| Published public browsing | No staff login; public-safe field projection and publication/window/visibility eligibility |
| Create/edit article or catalog description | content.create or content.update; content.read for internal lists; validated safe content |
| Publish/unpublish editorial/catalog content | content.publish; applicable content scope and record version |
| Activate hero campaign | campaigns.manage AND content.publish; referenced target eligible/public |
| Edit request budget dropdown | services.budgets.manage, not content.update alone |
| View business request / internal request PDF | inquiries.read; PDF additionally documents.export |
| Change request lifecycle / approve request for project | inquiries.manage; approved verified contact prerequisite for client project |
| Edit/finalize quotation | quotations.manage AND inquiries.read for linked request |
| Send quotation revision | quotations.send AND quotations.read AND inquiries.read; finalized revision and verified recipient |
| Review program applications/documents | applications.read/manage as applicable; technical assignee instead sees only a referred assessment |
| Read or reply to general enquiry | contacts.general.read; modification contacts.general.manage; sending additionally communications.general.send |
| Read or reply to business enquiry | inquiries.read/manage; sending additionally communications.business.send |
| Refer enquiry | contacts.refer AND current source read/manage; recipient's destination permission and explicit release scope |
| Manage product waitlist | waitlists.read/manage; no public subscriber directory |
| View event registrations | registrations.read; changes registrations.manage; capacity settings events.operations.manage |
| Scan ticket | events.checkin plus authorized event scope, no registration-list permission implied |
| Create client project | projects.manage AND access to an approved limited project-intake projection, not broad inquiries.read |
| Complete milestone / notify | projects.manage; explicit client notification confirmation additionally projects.notify |
| Edit profile titles / team access | Existing team.manage controlled server workflow; role assignment separately roles.assign; no self-promotion |
| Audit review | audit.read for owner; audit.technical.read only carefully classified technical metadata for Kevin |

Do not implement broad checks such as content.publish OR events.operations.manage
for an operation requiring both editorial and operational authority. Split fields
and commands by capability. Operations cannot publish magazine content through an
event-management API; Content cannot change registration capacity or read contacts
through an event-editor response.

## Confidentiality and referral rules

Kevin's projects.read permits approved technical scope, milestone state, request
reference and the single verified delivery contact needed for authorized progress
mail. It excludes request attachments unless individually shared, original enquiry
threads, budgets, quotations, other applicants and broad exports. Prefer an
opaque client-contact reference with server-resolved delivery rather than exposing
email in ordinary project lists. Client-safe progress copy is separated from
internal technical notes.

An assessment is an explicit, auditable release: source record, referring actor,
target technical workspace, selected fields/document IDs and status. It does not
unlock the source inbox. No unrestricted join from project/assessment IDs to
private request/application tables. Divine sees only general/community records;
business records move out of her view on reclassification, apart from a sanitized
referral acknowledgement. Source attachments do not follow automatically.

Company Overview is a dedicated public-within-company projection, not client-side
filtering of a complete admin payload. Nateu can see coordination status without
project-edit rights. Audit events are not the overview feed; their payloads need
their own classifications and read permissions.

## Enforcement design for later implementation

Reuse src/lib/auth/core.ts and server.ts for request-scoped verified membership and
required code checks. Never pass roles from a form as authorization. Every business
query must use the caller's SSR client with RLS where possible. New tables need
explicit grants, scoped permissive policies and restrictive live-AAL2 checks
equivalent to app_private.has_aal2_session(); existing policy coverage is not
inherited. Policies must avoid recursion and definer functions must use qualified
objects/restricted search_path. Private Storage policies require the same scope.

Service-role credentials bypass RLS and are not permission proofs. Existing
createAuthFlowStore() remains fixed-purpose; do not add business CRUD to it.
Necessary public ingress, audit writes, projection publication, PDF jobs and
outbox delivery need separately reviewed narrow server/SQL interfaces. Validate
exact operation, actor/authority, target and payload; prevent public callers
selecting resource owners, arbitrary role codes or recipient addresses.

Background jobs consume an immutable authorized intent, not an untrusted browser
payload. Define a dedicated job identity/interface, lease/attempt state and allowed
operation list. Recheck actor activity/current authority and target validity before
private dispatch; suspend and require fresh review if authorization was removed.
No bearer service secret is accepted as an application user's AAL2 session.

Local tests must enumerate every allow and deny in this document with genuine
caller sessions and direct REST/database/Storage attempts, including row-ID
substitution, inactive profiles, AAL1 and missing roles. The current exact-catalog
tests will need explicit extension when new permissions are approved, while
retaining assertions that all original grants remain correct and no forbidden
business access is introduced. No changes were made to those tests in Stage 4A.0.
