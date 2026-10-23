# Stage 2D.4 invitation and recovery readiness

These limited routes exist locally and are **not deployed**. No founder account,
email, profile, or role was created. Public signup remains disabled.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
ignored `.env.local`. A cryptographically random, server-only
`AUTH_FLOW_SIGNING_SECRET` is also required. The local file has been configured
without printing the value. For another environment, generate at least 32
random bytes with a trusted secret manager and store it only in that
environment's server-side secret store. Never use a `NEXT_PUBLIC_` prefix.
The confirmation POST validates this secret **before** consuming an email token.

`GET /auth/confirm` displays Continue without calling Auth. Its POST endpoint
`/auth/confirm/complete` accepts only `invite` or `recovery` and calls
`verifyOtp({ token_hash, type })`. It verifies the returned user with `getUser`,
stores the SSR session, and issues a ten-minute signed HttpOnly flow ticket
bound to the user ID and flow type. The invite goes to `/auth/set-password`;
recovery goes to `/auth/reset-password`. Both password routes require that
ticket and a freshly verified Auth user. Passwords must match and have at least
12 characters. The handler updates Supabase Auth, clears the flow ticket, and
signs out locally. An invitee with no RBAC assignment sees a neutral pending
activation message and gains no staff access.

`/auth/forgot-password` requests recovery mail using the fixed local redirect
`http://localhost:3000/auth/confirm` and gives the same response whether or not
the address exists. This POST is **disabled in production**, on non-loopback app
hosts, and whenever the configured Supabase URL is not a loopback HTTP URL. An
accidental local run against the hosted project therefore cannot send recovery
mail. Supabase Auth's own email and verification limits remain a second layer.
There is no shared application rate-limit store: a process-local counter would
not enforce limits across multiple Next.js instances. Before public deployment,
integrate a durable IP and recipient-hash limiter at the edge or through a
shared store (for example managed Redis), fail closed if it is unavailable,
configure Supabase **Authentication > Rate Limits** and per-recipient cooldown,
and test with the SMTP provider. Do not enable CAPTCHA before the request sends
a valid challenge token. The public recovery flow is **not production-ready**.

The Next.js proxy marks Auth responses no-store, no-referrer, and noindex.
Form POSTs require a same-origin Origin header. Flow tickets are signed,
HttpOnly, SameSite=Lax, expire after ten minutes, and match the verified user.
Successful password changes clear the ticket and sign out the session. A copied
ticket could still be replayed inside its lifetime if an attacker also retains
a valid session for the same Auth user; the ticket has no shared one-time nonce
store. Strict replay prevention needs an atomic, durable consume operation and
must be implemented and tested before public rollout.
Redirects are fixed same-origin paths. Missing, expired, or used links receive
generic errors; token and password values are never logged. GET cannot consume
an email token, including when a security scanner prefetches the link.

## Supabase Dashboard templates and URL settings

In project `onfxxtvfprjnqsxdmhkp`, open **Authentication > Email > Templates**.
For **Invite User**, use this action-link target:

```text
{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite
```

For **Reset Password**, use:

```text
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery
```

Review the final rendered links against the [Supabase template guidance](https://supabase.com/docs/guides/auth/auth-email-templates)
before saving. Keep **Authentication > URL Configuration > Site URL** at
`http://localhost:3000` for local testing. Add the exact
`http://localhost:3000/auth/confirm` to **Additional Redirect URLs** before
testing recovery. Do not add wildcards or the production domain until the
application is actually deployed there. These Dashboard changes have not been
made by this stage. Custom SMTP delivery remains unverified.

## Local integration test preparation

The local CLI config now uses `http://localhost:3000` as Site URL, allows the
exact `http://localhost:3000/auth/confirm` redirect, and contains local-only
invite/recovery email templates under `supabase/templates/`. Local Mailpit is
configured on port 54324. The local PostgreSQL port is 65432 because Windows
reserved 54322 on this computer. The linked hosted project is separate and
unchanged.

Because this computer currently runs the database-only stack, first run
`npx supabase stop --project-id bewiseinnovations.com` (without `--no-backup`),
then `npx supabase start` and inspect `npx supabase status`. Starting while the
database-only container is already running does not bring up the missing Auth
services. The app process must use the **local** API URL and local publishable
key returned by that CLI, while retaining the ignored local signing secret.
Do not use the hosted key/URL for this exercise. Run `npm run dev` on localhost.
Use only a disposable address such as `invite-test@example.invalid` in local
Supabase Auth; local Mailpit captures mail without delivering it. A local
administrator can issue the invitation, inspect its link in Mailpit, open the
GET confirmation page (which must not consume the token), press Continue to
POST, set a test password, and verify that the unassigned user has no staff
access. Then submit a local recovery request, verify the recovery link through
the same GET/POST flow, reset the password, and remove the disposable local Auth
user. Never copy a live token into chat, logs, or issue trackers.

An attempted full local stack start in Stage 2D.4 stalled while downloading
missing Mailpit, API gateway, and PostgREST images, so no real Auth/Mailpit
end-to-end result is claimed. The database-only stack was restored on port
65432 and the real 42-assertion PostgreSQL policy suite passed. The Auth route
tests are mocked and do not prove Supabase email or cookie behavior. Before a
founder invitation, complete this disposable local test and review
[platform-owner-provisioning.md](./platform-owner-provisioning.md).

For harmless local route checks, run `npm run dev`, visit
`http://localhost:3000/auth/confirm` without a token, and verify it shows a
generic invalid-link message. Visit `/auth/forgot-password` to inspect the
form, but do not submit a real mailbox until the controlled test is approved.
Run `npm run test:auth`, `npx supabase test db`, `npm run typecheck`, `npm run
lint`, and `npm run build` for automated validation. The public recovery POST
remains disabled until a distributed limiter and its failure behavior are
implemented and tested.
