# Stage 2D.5 invitation and recovery security

These limited routes exist locally and are **not deployed**. No founder account,
email, profile, or role was created. Public signup remains disabled.

Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in
ignored `.env.local`. A cryptographically random, server-only
`AUTH_FLOW_SIGNING_SECRET` is also required. The local file has been configured
without printing the value. For another environment, generate at least 32
random bytes with a trusted secret manager and store it only in that
environment's server-side secret store. Never use a `NEXT_PUBLIC_` prefix.
The confirmation POST validates this secret **before** consuming an email token.
The new `SUPABASE_AUTH_STORE_SECRET_KEY` must be a server-only Supabase
secret/service-role key for the **same** project as the URL. It is not set here.
Use only the local CLI service-role credential for local integration tests.
Never prefix this key with `NEXT_PUBLIC_` or put it in browser code.

`GET /auth/confirm` displays Continue without calling Auth. Its POST endpoint
`/auth/confirm/complete` accepts only `invite` or `recovery` and calls
`verifyOtp({ token_hash, type })`. It verifies the returned user with `getUser`,
stores the SSR session, and issues a ten-minute signed HttpOnly flow ticket
bound to the user ID and flow type. Before token verification it checks the
database RPC; after verification it stores only the SHA-256 hash of the ticket's
random 256-bit identifier. The invite goes to `/auth/set-password`;
recovery goes to `/auth/reset-password`. Both password routes require that
ticket and a freshly verified Auth user. Passwords must match and have at least
12 characters. A conditional PostgreSQL UPDATE atomically redeems the ticket
before the password update, so only one concurrent request can succeed. The
handler then clears the cookie and signs out locally. An invitee with no RBAC
assignment sees a neutral pending
activation message and gains no staff access.

If the password update fails after redemption, the ticket stays consumed to
prevent replay. Recovery users request a new recovery email; invitees ask a
trusted administrator to resend the invitation. If ticket registration fails
after OTP verification, the email token may also be spent; request a new link.
GET pages never redeem tickets.

`/auth/forgot-password` requests recovery mail using the fixed local redirect
`http://localhost:3000/auth/confirm` and gives the same response whether or not
the address exists. This POST is **disabled in production**, on non-loopback app
hosts, and whenever the configured Supabase URL is not a loopback HTTP URL. An
accidental local run against the hosted project therefore cannot send recovery
mail. The new PostgreSQL limiter atomically allows three requests per
normalized email and thirty overall per fixed hour. Only HMAC-SHA256 bucket
keys are stored, not raw email addresses. A transaction-scoped advisory lock
serializes concurrent requests across instances. The current global cap fits
the small invitation-only team but needs review before wider use. Expired
bucket and redeemed ticket rows need periodic, separately reviewed cleanup;
they do not grant additional requests.
The app deliberately ignores client-supplied `X-Forwarded-For` and other proxy
IP headers, which cannot be trusted without an ingress that overwrites them and
blocks direct origin access. The email and global quotas are the current abuse
signals. If the limiter or server credential is unavailable, no email is sent
and the response stays generic. Supabase Auth's own limits are a second layer.
Do not enable CAPTCHA without sending its challenge token. The production
recovery POST remains **disabled** until the migration, key, and end-to-end
behavior are deployed and verified.

The Next.js proxy marks Auth responses no-store, no-referrer, and noindex.
Form POSTs require a same-origin Origin header. Flow tickets are signed,
HttpOnly, SameSite=Lax, expire after ten minutes, and match the verified user.
Successful password changes clear the ticket and sign out the session. The
ticket and quota tables live in non-exposed `app_private` with RLS and no direct
grants to `anon`, `authenticated`, or `service_role`. Four narrow public RPCs
are executable only by `service_role`; the Next.js caller is `server-only`.
The service-role key is powerful and must be rotated after suspected exposure.
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

## Local Auth and Mailpit integration test (Stage 2D.6)

The local CLI config now uses `http://localhost:3000` as Site URL, allows the
exact `http://localhost:3000/auth/confirm` redirect, and contains local-only
invite/recovery email templates under `supabase/templates/`. Local Mailpit is
configured on port 65424. The local PostgreSQL port is 65432 and the local API
gateway is 65421 because Windows reserved the usual ports on this computer.
The linked hosted project is separate and unchanged. Local Auth's email send
allowance is 20 per hour to accommodate this test; this is not a hosted setting.

For a repeatable test, start the essentials with
`npx supabase start --exclude studio,realtime,storage-api,imgproxy,edge-runtime,logflare,vector,supavisor`.
Use `npx supabase status --output json` locally to obtain the **local** API URL,
publishable key and service-role key. Place them in ignored `.env.integration.local`
as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and
`SUPABASE_AUTH_STORE_SECRET_KEY`. Copy the existing local
`AUTH_FLOW_SIGNING_SECRET` into that file. Never use the hosted service-role
key. Keep `.env.local` pointed at the hosted project; the integration harness
explicitly loads `.env.integration.local` and rejects a non-loopback API URL.
Run `node scripts/test-local-auth-integration.mjs`. It starts local Next.js,
uses a disposable `example.invalid` identity, captures messages through
Mailpit, tests the App Router GET/POST routes, and deletes the disposable Auth
user and its captured messages. It never sends to a real recipient. Mailpit is
viewable at `http://127.0.0.1:65424` for manual inspection. Do not copy a
live token into chat, logs, or issue trackers.

On 23 October 2026, the complete local Auth/Mailpit integration passed for
invitation and recovery. The test verified that two GETs did not use each
email token; a user-initiated POST did; session and HttpOnly SameSite cookies
were set; password validation and wrong-flow requests were denied; password
ticket reuse failed; the old password failed after recovery while the new one
worked; and the invited user had no profile or role. Invalid token and type
requests failed safely. Disposable local Auth users and captured emails were
deleted. The 74 pgTAP assertions and multi-session PostgreSQL concurrency test
also passed after adjusting test fixtures to isolate them from integration
data. Local-only rate-limit bucket rows expire by hourly window; they do not
contain email addresses. The Auth route unit tests remain mocked (27 cases).

The end-to-end harness does not yet simulate Auth token expiry, browser-level
cookie storage, forced session expiry, or a production distributed deployment.
Those protections have unit/database coverage where applicable, but must not
be confused with completed hosted validation. Production recovery submission
remains disabled until the local-only security migration is separately
approved and deployed, a server-only production store credential is configured,
and hosted integration plus SMTP delivery are verified. Before a real founder
invitation, review [platform-owner-provisioning.md](./platform-owner-provisioning.md).

For harmless local route checks, run `npm run dev`, visit
`http://localhost:3000/auth/confirm` without a token, and verify it shows a
generic invalid-link message. Visit `/auth/forgot-password` to inspect the
form, but do not submit a real mailbox until the controlled test is approved.
Run `npm run test:auth`, `npx supabase test db`, `npm run
test:db:concurrency`, `npm run typecheck`, `npm run lint`, and `npm run build`
for automated validation. The public recovery POST remains disabled until the
new migration and server-only key are deployed and the full Auth/Mailpit test
passes. Hosted deployment and configuration require separate approval.
