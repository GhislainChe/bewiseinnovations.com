# Stage 2B database foundation

These migrations are **local drafts** for the already linked project
`onfxxtvfprjnqsxdmhkp`. No migration has been applied remotely. On
2026-10-22, `supabase migration list --linked` showed both local versions as
absent remotely. Read-only hosted schema dumps found no application objects in
`public`, no `app_private` schema, and an existing `auth.users` table. Recheck
these facts immediately before any future deployment, and confirm
`app_private` is absent from the Data API's exposed schemas.

## Files and relationships

| Table | Purpose and key relationship |
| --- | --- |
| `team_profiles` | Staff details keyed by `auth.users.id`; deleting an Auth user cascades to this profile. |
| `roles` | Stable role codes and descriptions. |
| `permissions` | Stable permission codes and descriptions. |
| `role_permissions` | Many-to-many role-to-permission map; deleting a catalog entry removes its mappings. |
| `team_role_assignments` | Many-to-many user-to-role map; deleting a profile removes assignments, while a referenced role cannot be deleted. |
| `audit_logs` | Append-only administrative events. Deleting a profile clears `actor_id` but retains the event. |

The profiles table maintains `updated_at` with a trigger. Roles and permissions
have unique, constrained codes. Audit metadata must be a JSON object. Foreign-key
lookup and audit timeline indexes are included. The model supports multiple
roles per user; later account-provisioning rules will initially assign **one**
approved role to each founder.

## Seeded authorization catalog

The second migration upserts four roles and 18 permissions, then inserts the
31 role-to-permission mappings if absent. Reapplying the seed does not create
duplicate catalog rows or mappings. It creates no Auth users, founder profiles,
or role assignments.

| Role | Granted permissions |
| --- | --- |
| `platform_owner` | All 18 permissions, including `team.read`, `team.manage`, `roles.assign`, `settings.manage`, all content, inquiry, registration, and waitlist permissions, `audit.read`, `audit.technical.read`, `technical.read`, and `technical.manage`. |
| `technical_lead` | `technical.read`, `technical.manage`, `audit.technical.read`. |
| `operations_lead` | `inquiries.read/manage`, `registrations.read/manage`, `waitlists.read/manage`. |
| `content_community_lead` | `content.read/create/update/publish`. |

The content permissions cover future service, portfolio, product, event
description, and announcement modules. The business permissions are catalog
entries only until those tables and server modules exist. Technical audit access
is restricted to rows marked `resource_type = 'technical'`; future writers must
use that classification carefully and never place private inquiries, participant
records, credentials, or tokens in technical audit metadata.

## RLS and mutation boundary

RLS is enabled on every new table. Anonymous users have no table grants or
policies. Active authenticated staff can read their own profile and assignment.
The platform owner can read all profiles and assignments through `team.read`.
Active staff can read the role/permission catalog, which contains no identities.
The owner can read all audit events through `audit.read`; the technical lead sees
technical events only. Operations and content staff see no audit events.
Inactive profiles confer no read access or permissions.

`app_private.is_active_staff()` and `app_private.has_permission(code)` perform
caller-specific lookups without recursive RLS. They are `SECURITY DEFINER`
functions with an empty `search_path`, schema-qualified references, and no
mutation capability. Only `authenticated` can execute them. `app_private` must
stay outside the exposed Data API schemas. Authorization comes from database
assignments, never frontend-supplied roles or mutable Auth user metadata.

No direct `INSERT`, `UPDATE`, or `DELETE` grants or RLS policies are given to
ordinary authenticated clients on these tables. Thus even a platform owner
cannot change their own role over the client connection. The planned account
administration and audit-writing workflows must run on the server with tightly
scoped privileged credentials, verify the acting user's current `team.manage`
and `roles.assign` permissions from the database, reject self-role changes,
validate target IDs and allowed role codes, and commit the change and audit event
in one transaction. No such workflow or privileged key is implemented yet.

## Local verification and later deployment

With Docker Desktop running on Windows, use a **local** stack:

```sh
npx supabase start
npx supabase db reset --local
npx supabase test db
```

`supabase/tests/rbac.test.sql` runs 42 pgTAP assertions against real local RLS
policies. It creates synthetic, email-free Auth rows only within a transaction
that rolls back; they are not founder accounts. Tests cover anonymous denial,
own-profile reads, role boundaries, inactive staff, direct mutation denial, and
technical-only audit visibility, exact role-permission mappings, and key
database grants. On 2026-10-22, all 42 assertions passed against
the local PostgreSQL stack. The local catalog contained six RLS-enabled tables,
four roles, 18 permissions, and 31 role-permission mappings, with no persisted
team profiles or assignments. No remote migration was applied.

Before any future remote push, take a fresh schema-only snapshot and review
migration history again. Check that the public schema still has no conflicting
tables or policies and confirm the remote PostgreSQL major version. Then review
a dry run and obtain separate approval for deployment. Never use
`db reset --linked` on this project.

## Founder account bootstrap, later stage

1. Verify each founder's actual email address out of band. A Supabase project
   administrator invites or provisions the Auth account through an approved
   administrative flow. Require email verification and secure account setup.
2. Read the resulting immutable `auth.users.id` and verified email from the
   Supabase Auth dashboard. Match it to the intended founder; never guess an
   address or use user-editable metadata to choose a role.
3. For the **first** platform owner, a trusted database administrator performs a
   reviewed, one-time transaction that inserts the profile for Ndong Ghislain
   Che's verified Auth ID, assigns the seeded `platform_owner` role, and writes
   a bootstrap audit event. This exceptional step uses the SQL editor or a secure
   administrative environment, not a browser client or public signup trigger.
4. Provision Kevin Omgba (`technical_lead`), Nateu Farhel (`operations_lead`),
   and Divine Nguemo (`content_community_lead`) only after their verified Auth
   IDs are available. Assign exactly one approved role each, then confirm the
   resulting permissions and log the actions. A later server workflow should
   enforce these rules for routine changes.

No account, email, password, service key, or access token is stored in these
migrations or tests. Never grant `platform_owner` to the first signup automatically.
