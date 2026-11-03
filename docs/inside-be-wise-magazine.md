# Inside BE WISE — Stage 4D.1

Implemented and tested locally on 2 November 2026. Hosted Supabase, Auth settings,
DNS and deployment were untouched. No founder accounts, permanent demonstration
accounts, messages, comments or invented company news were created.

## Public magazine

- `/inside-be-wise`: featured story, latest stories, category navigation, article
  cards, loading, unavailable and empty states. Category filtering uses
  `?category=<stable-slug>` and never returns another category's stories.
- `/inside-be-wise/[slug]`: published title, summary, approved byline/cover,
  first-publication date, published-content update date, structured body and up to
  three other public stories in the same category.
- WhatsApp, Facebook and LinkedIn share links contain only the published
  canonical article URL and encoded public title where applicable. Copy URL uses
  the clipboard, with a selectable public URL/failure message as fallback. No
  tracking SDK, provider API, automatic message, comments or visitor account.
- Public metadata reads the same published projection. Private previews have no
  share links, canonical preview URL or public draft endpoint. Unknown/draft/
  unpublished/inactive-category stories render the Next.js not-found boundary.
  Streamed not-found pages may have HTTP 200 with noindex; the public JSON detail
  endpoint returns 404. Public and private reads use no-store/dynamic rendering.

The four approved initial categories are Tech & Innovation, Inside Our World,
What If? and Community Stories. They are the only persistent magazine seed data.
The initial public magazine is intentionally empty; approved editorial material
must be entered and explicitly published by authorized local staff.

## Editorial workflow

`/internal/editorial` and `/internal/editorial-api` reuse the current staff SSR
session, active team membership, RBAC and verified TOTP-backed AAL2 checks.
Divine's existing `content_community_lead` permissions and explicitly mapped
Platform Owner permissions support the workflow. Professional titles do not
confer access and no accounts or role assignments are provisioned by this module.

1. Create a draft with title, unique URL slug, summary, public byline, category,
   optional approved cover and structured body. A saved document requires valid
   basic fields and at least one nonempty block. No author email or security
   role is public metadata. Use the approved display byline deliberately.
2. Add/edit/reorder/remove paragraphs, H2/H3 headings, numbered/bulleted lists,
   public HTTPS links and approved image references/captions. Save before preview.
3. **Preview saved draft** renders privately through the same safe body component
   as public pages. It is clearly labeled and does not publish.
4. **Publish article / Publish updated revision** validates the document and
   active category again, records a publication snapshot and advances the public
   pointer atomically with its audit event.
5. Draft edits remain private until explicit republishing. Public first-publication
   time is retained; the public update date reflects the current published
   revision, not an unpublished working edit or a feature toggle.
6. Select one featured public article. Replacing it atomically clears/audits the
   previous selection and increments its concurrency version. The workspace
   reloads fresh article versions after this operation.
7. Unpublish removes the public pointer and featured flag, while retaining
   internal publication history. Republish creates another saved revision.

Article and category slugs remain fixed after creation to preserve public URLs.
Collisions/stale versions return conflicts; no automatic mutation retry occurs.
After uncertain results, reload and inspect current records before retrying.
Browser submission locks and disabled controls prevent repeated clicks.

Categories can be created, renamed, ordered, activated and disabled. Disabling a
category hides its stories publicly until re-enabled; it does not delete drafts
or publication history. Public category labels/order are live publisher-managed
metadata, while article copy/byline/body remain saved revision snapshots.
There is no category deletion endpoint or automated multi-founder approval flow.
Earlier specification proposals for review/archive/scheduling are deferred; this
stage implements the explicitly requested draft/published workflow.

## Structured content and media safety

The editor stores a bounded JSON document, never raw HTML. Both TypeScript and
PostgreSQL validate exact allowed fields, block types, lengths, IDs and link
schemes. Unsupported embeds, inline scripts/styles, event handlers, HTML nodes,
SVG/iframe content, arbitrary image URLs and credential-bearing links are rejected.
Literal markup in a text block is React-escaped and displayed as text; it is not
interpreted as HTML. Rendering never uses `dangerouslySetInnerHTML` for articles.
The renderer additionally rechecks link safety and resolves images only from the
approved asset projection. External links use noopener/noreferrer/no-referrer.

The initial subset includes plain text within blocks, separate link blocks,
H2/H3, single-level ordered/unordered lists and images/captions. Inline emphasis,
nested lists, arbitrary Markdown/HTML import and embedded players are not provided.
Articles are limited to 80 blocks, 30 entries per list and a 60 KB UTF-8 document
in the application. The editorial HTTP adapter explicitly opts into a bounded
64 KiB envelope. The shared JSON reader retains its existing **16 KiB default**
for public project requests and other existing callers; oversized public
submissions have not been enabled.

Original BE WISE logo bytes, approved palette and self-hosted Quicksand fonts are
reused. There are currently no approved editorial cover/story assets, so no
article image or company story is invented. The media selector works with the
approved registry and explains its empty state. Uploads remain disabled.

For future approved images, a trusted local asset-registration procedure must
verify original file type, size/dimensions, rights/consent and metadata removal,
copy the approved public derivative under `/magazine-media/<safe-name>` and
record path, alt text, SHA-256, rights reference and explicit approval. Supported
extensions are PNG/JPG/JPEG/WebP/AVIF. No public or staff upload endpoint exists
in this stage. Do not store confidential draft/client/applicant files there:
approved static files are public independently of article publication. Revoking
approval hides them in projections but does not retract previously distributed
bytes; file/CDN revocation needs a separate operational procedure.

## Database and permissions

New LOCAL migration: `20261102030000_inside_be_wise.sql`. It creates four tables in
the existing unexposed `business_private` schema:

- `magazine_categories`: approved category metadata, activation/order and version.
- `magazine_assets`: approved public derivatives and private rights/checksum data.
- `magazine_articles`: stable slug, working JSON document, concurrency version,
  featured state and current published pointer.
- `magazine_revisions`: saved publication snapshots and monotonically numbered
  publication history. An update trigger rejects snapshot overwrites; composite
  foreign keys ensure a public pointer belongs to that exact article. There is
  no caller-accessible revision update/delete or article deletion endpoint.

RLS is enabled with restrictive MFA policies on all four tables. Direct API-role
table access is revoked, including service_role table grants. Narrow public
SECURITY DEFINER functions use empty search_path and qualified objects. Anonymous
callers receive only active categories and eligible published snapshots. Private
draft/category versions, asset rights/checksums and revision records do not enter
public projections. Privileged ingress credentials cannot execute editorial
mutations. Staff operations use the genuine caller JWT and repeat authorization
in both application and database; they do not impersonate service_role.

No new permissions or role identifiers. Existing checks:

- `content.read`: private lists, detail, assets and saved preview.
- `content.read` + `content.create`: new article drafts.
- `content.read` + `content.update`: edit working drafts.
- `content.read` + `content.publish`: publish/unpublish and feature selection.
- Category changes additionally require update + publish; new categories also
  require create because their names/activation affect public presentation.

Current LOCAL totals remain **4 roles, 29 permissions, 55 mappings**. Technology,
Operations, inactive/unassigned accounts and password-only AAL1 callers cannot
read editorial drafts or mutate them. Editorial capabilities grant no client
inbox, quotation, subscriber, profile or role-assignment access.

All sensitive category/draft/publication/feature changes audit transactionally,
without article bodies, credentials or client payloads in audit metadata. Writes
use optimistic versions; publication and featured selection additionally serialize
through a transaction advisory lock. At most one featured article exists. Audit
failure rolls back the database statement instead of leaving a partial change.

## Validation results

- **9/9** new mocked-boundary/model/HTTP tests: slug and exact command contracts,
  structured content, unsafe embeds/links, category/publication intent, safe share
  URL construction, Origin rejection, safe authorization/conflict/provider errors,
  explicit editorial body limits and unchanged public defaults.
- **155/155** combined unit/adapter regressions: 78 Auth, 32 Services, 9 Quotations,
  9 Delivery, 7 Projects, 11 Products and 9 Magazine. Legacy finalized PDF bytes
  and original logo hashes remain unchanged.
- **394/394** pgTAP assertions on the active local PostgreSQL database, including
  **50 new magazine assertions** for publication/revision isolation, RLS/grants,
  AAL1/inactive/unassigned/other-role denial, safe documents, media approval,
  conflicts, featured replacement, category filtering, history and audit rollback.
- A fresh isolated PostgreSQL 17 database replayed **all 12 migrations in order**
  and passed the same **394 assertions**, **30 owner-bootstrap assertions** and
  existing atomic ticket and shared quota concurrency checks. Development data
  was preserved; the isolated test container was removed.
- **32 real LOCAL Auth/TOTP/JWT/RPC/HTTP checks**: genuine AAL1 denial and verified
  AAL2 caller authorization, forged-JWT rejection, Content/Owner versus other
  roles, category/draft management, CAS race (one accepted edit), private working
  copy isolation, publication revisions, feature replacement, public categories,
  Origin failure and explicit unpublication.
- **20 real headless Chrome checks**: anonymous/Operations editorial denial,
  Content creating a structured draft, saved preview, actual script-like text
  rendering without execution, explicit publication/feature, private draft edit
  protection on public pages, category filtering, real approved-logo image
  rendering, safe link attributes/sharing, successful clipboard URL copying,
  375-pixel layout without horizontal overflow, category rename/disable and
  not-found behavior after removal. No external share link was activated and no
  social-provider delivery was tested or claimed.
- The Git-ignored synthetic screenshot
  `.supabase/browser-tests/magazine-public-mobile.png` was visually inspected.
  Tests temporarily reused the supplied company logo, byte-for-byte, solely as
  a synthetic approved media fixture; its file/registry entry were removed.

TypeScript, ESLint and the production build passed. All **30 generated production
browser artifacts** were scanned in memory against privately configured secret
values; no matches. Environment files were neither printed nor modified. The
same local-only launcher was restarted after the build for review; no second
server was started and password recovery remains disabled.

Post-test state: four approved categories; zero articles, revisions, magazine
assets, Auth test identities, profiles or role assignments. Existing Meet My Crew
draft, seven services/42 budget options and original client request remain intact.
Synthetic tests used only the fixed LOCAL API/database, genuine local Auth sessions
and exact run-prefixed cleanup; no founder accounts or persistent demo logins.

## Local review and limitations

With the existing private local Supabase configuration and Docker services:

```powershell
npx supabase migration up --local
npm run dev:business
```

Use `http://localhost:3022/inside-be-wise` and
`http://localhost:3022/internal/editorial`. The latter requires an authorized
active LOCAL editorial identity and verified AAL2. `/inside-be-wise/[slug]` becomes
available only after explicit publication in an active category. `npm run
test:magazine:local` performs a disposable, headless local review and removes its
fixtures. Do not start the ordinary app with inherited hosted-test credentials.

No approved production articles/media have been supplied. Upload/quarantine/
scanning, scheduling, richer inline formatting, revision restoration, author
profile entities, pagination/search for large editorial catalogs and production
CDN/cache handling are deferred. Internal publication history currently shows
revision numbers and dates; it does not expose or restore old content in the UI.
Use approved copy and bylines, image rights and accessibility review before real
publication. Already downloaded/publicly shared material cannot be recalled by
unpublishing a page. No public staging configuration is enabled here.

Recommended next stage: review the functional editorial workflow, supply approved
story copy/media, then separately approve the next platform module. No automatic
publication, deployment, founder onboarding or subsequent implementation occurs.

## Files

New application files are under `src/features/magazine/`: validation/types, safe
content rendering, public landing/detail components, sharing controls, editorial
UI, genuine caller data access, bounded HTTP adapters, styles and focused tests.
New App Router files cover `/inside-be-wise`, its loading/detail routes,
`/api/magazine`, `/internal/editorial` and `/internal/editorial-api`.

New SQL: the migration above and `supabase/tests/magazine.test.sql`.
New test helpers: `scripts/local-auth-fixtures.ts`,
`scripts/test-local-magazine-integration.ts`, `scripts/test-magazine-browser.mjs`.
The existing local Chromium and database helpers are reused.

Updated integration points: public Services/Products navigation, staff
Services/Projects navigation, `src/features/services/submission.ts` (bounded reader
option with unchanged default), package scripts, fresh migration/test expectations,
the business-table RLS test count, README and this report. No existing migration,
authentication/MFA handler, quotation PDF bytes or environment file was rewritten.
