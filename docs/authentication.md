# Stage 2C.1 authentication backend

This is an invitation-only internal system. There is no login page, callback
route, registration endpoint, dashboard, account-provisioning endpoint, or
administrative secret in this stage. The hosted project has not been changed.

## Session and authorization flow

The browser and server factories in `src/lib/supabase/` use the project URL and
publishable key with `@supabase/ssr` cookie storage. `src/proxy.ts` is the Next.js
16 session-refresh entry point for future `/internal/*` routes. It calls
`getClaims()` to verify and refresh the access token, writes updated cookies to
both request and response, and carries Supabase's cache headers onto the
response. The response also sets `Cache-Control: private, no-store`. The proxy
does not grant access. Extend its matcher when protected routes are introduced.

Every protected server operation must call `requireTeamMember()` or
`requirePermission(code)` in `src/lib/auth/server.ts` within that request. The
operation calls Supabase Auth `getUser()` for a fresh, server-confirmed identity,
then reads the caller's active profile, assigned roles, and role permissions
through the same request-scoped, RLS-bound client. Missing, inactive, or
unassigned profiles are denied. Database query errors fail closed. Role names
from browser input, mutable Auth metadata, `getSession()` user objects, and
proxy-only checks are never authorization sources. Future authenticated pages
must be dynamic and must not be served from ISR or shared caches.

The backend provides password sign-in, current staff lookup, permission checks,
and current-session sign-out as **server-side utilities only**. A successful
Auth password sign-in is immediately checked for staff authorization; an
unprovisioned account is signed out. Sign-out uses Supabase's `local` scope so
other devices are unaffected. There is no public callable route or Server Action
yet. Future sign-in actions must accept POST only, validate input, apply rate
limits, and return generic credential errors.

## Invitations, recovery, and expiration

An eventual invitation callback should accept a one-time Auth `code`, exchange
it server-side with `exchangeCodeForSession`, and use only an allowlisted,
same-origin return path. `safeAuthReturnPath()` is provided for that final step.
The callback must avoid logging codes, tokens, cookies, and recovery links.
After exchange, it must still call the database-backed staff check. A future
recovery flow should request a recovery email with a fixed allowed redirect,
then exchange the one-time code and permit a password update only in the
verified recovery context. Use generic responses to avoid account enumeration
and apply rate limiting. Neither callback nor recovery endpoint exists yet.

The proxy refreshes expiring tokens. An expired or invalid Auth session cannot
pass `getUser()`; an inactive profile loses database-backed access on the next
authorization check. For especially sensitive future mutations, recheck the
user and permission within the operation and do not cache authorization state.

## Controlled founder provisioning (future approved operation)

1. Verify the real email address and identity of each founder out of band.
   Confirm that hosted Supabase Auth has **Allow new users to sign up** disabled,
   email confirmation enabled, and only approved callback URLs configured.
   The local CLI config disables global signup while leaving the email
   provider enabled for invited users. It requires email confirmation and a
   stronger password. These settings have **not** been applied to the hosted
   project; the Stage 2C.3 preflight found hosted global signup enabled.
2. A trusted project administrator sends an invitation from the Supabase
   Dashboard or a restricted server-only admin environment. Any future
   `sb_secret_`/service-role key belongs only in that environment, never in a
   `NEXT_PUBLIC_*` variable, browser bundle, repository, or public endpoint.
   An invite may create an unconfirmed Auth user; it does not grant staff access.
3. Obtain the actual `auth.users.id` and verified email from Supabase Auth.
   Match them against the approved founder identity. In a reviewed transaction,
   insert the profile, assign exactly one seeded role, and write an audit event.
   Check for existing assignments and refuse self-role changes. Verify the
   resulting permissions with a separate read. If invitation and database
   provisioning cannot both complete, leave the account without application
   access and reconcile it manually; never grant by metadata or signup order.
4. For the **first** Platform Owner, a database administrator performs that
   one-time transaction for Ndong Ghislain Che's verified Auth ID after an
   independent review. There is no automatic first-user promotion. Subsequent
   routine administration needs a separately reviewed privileged server
   workflow that rechecks `team.manage` and `roles.assign`, rejects self-role
   changes, and writes the change and audit event atomically.
5. Provision Kevin Omgba as `technical_lead`, Nateu Farhel as
   `operations_lead`, and Divine Nguemo as `content_community_lead` only after
   the same identity checks. No email addresses or accounts are recorded here.

The two Stage 2B migrations and all pgTAP policies remain unchanged.

## Local configuration and tests

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
ignored `.env.local`; see `.env.example`. No administrative secret is needed by
this stage. The placeholder homepage still builds without these variables.
Restart the local Supabase Auth service after changing `supabase/config.toml` for
the signup setting to take effect. If using only PostgreSQL for pgTAP, Auth is
not started and the setting cannot be exercised there.

```sh
npm run test:auth
npx supabase test db
npm run typecheck
npm run lint
npm run build
```

`test:auth` uses mocked gateways to test backend decisions and session cleanup.
`supabase test db` exercises real local PostgreSQL RLS policies with synthetic
rows in a rolled-back transaction. The mocks do not prove Auth service behavior,
email delivery, or hosted configuration. Those require separate pre-release
integration tests and verification after the backend is deployed.
