# Stage 2D.5 invitation and recovery security

For the current opt-in sign-out cookie investigation and separately approved
browser Network procedure, see [sign-out cookie diagnostics](./sign-out-cookie-diagnostics.md).
Instrumentation does not establish cookie removal or revoke additional sessions.

Stage 2E.2 adds local TOTP enrollment/challenge, minimal sign-in, verified AAL2
staff guards and a NEW local-only MFA RLS migration. See
[MFA and owner recovery](./mfa-and-owner-recovery.md) for tests, operational
recovery requirements and approval-gated hosted steps. Hosted recovery is off.

For current first-owner activation blockers and the approval sequence, see
[Stage 2E.1 owner readiness](./platform-owner-readiness.md). MFA enforcement,
enrollment/challenge and operational recovery are not implemented merely by
having a functioning invitation/password flow.

Stage 2D.25 completed the separately authorized historical trace and disposable
hosted account cleanup. See [cleanup results](./auth-test-cleanup-result.md).
The development server was left stopped; no new invitation is authorized.

Stage 2D.24 verified synthetic fragment invite/recovery behavior and recorded
owner confirmation of the exact saved hosted templates. See
[privacy cleanup readiness](./auth-privacy-cleanup-readiness.md) for the current
read-only account review, preserved trace inventory and separately approved
cleanup steps. No cleanup or hosted email test was executed.

Current Stage 2D.23 behavior: confirmation tokens now use URL fragments, not
queries; legacy query links fail closed. Checked sign-out failures offer an
explicit retry instead of pending-activation success. See
[trace privacy and sign-out](./auth-trace-privacy-and-sign-out.md) for required
manual email-template updates, trace cleanup precautions and validation.

For the Stage 2D.10 manual credential setup, final localhost Dashboard templates,
controlled test/cleanup procedure and outstanding browser-cookie/recovery gates,
see [hosted authentication configuration](./hosted-auth-configuration.md).

## Stage 2D.11 corrections

Flow cookie creation and deletion now use shared helpers and the same
`auth_flow` name, host-only domain scope, and `/auth` path. Creation retains
HttpOnly, SameSite=Lax, ten-minute Max-Age, and Secure on HTTPS (localhost HTTP
is the local exception). Success, failed password saves and caught errors
expire the exact cookie with Max-Age=0 and an epoch Expires value. GET never
deletes or redeems tickets. Validation and wrong-flow errors preserve the ticket
so a legitimate retry does not consume it; expiry and atomic database redemption
still determine whether it can be used. The former default `/` deletion did
not clear the `/auth` cookie in a browser.

Recovery now separates local and hosted testing with server-only configuration:

| Setting | Meaning |
| --- | --- |
| `AUTH_RECOVERY_MODE` omitted or `local` | Development against HTTP loopback Supabase only |
| `AUTH_RECOVERY_MODE=disabled` | No recovery submission |
| `AUTH_RECOVERY_MODE=hosted-local-test` | Explicitly approved development test against the exact hosted project |
| `AUTH_RECOVERY_TEST_ORIGIN=http://localhost:3000` | Additional required acknowledgement for hosted testing |

No hosted-testing flag was set in this stage. Both modes require development
runtime, exact request origin `http://localhost:3000`, matching Host, and no
conflicting forwarded host/protocol headers. Forwarded headers never select
the trusted origin. Production and known managed deployment/CI environments
are denied even when the hosted-testing settings are present. The mode is
not a production recovery enablement switch. Bind the approved development
server to `127.0.0.1`; never expose it through a LAN address or tunnel.

Hosted mode requires exactly
`https://onfxxtvfprjnqsxdmhkp.supabase.co`. The handler validates public
configuration, the server-only store credential and signing secret, then checks
the ready RPC and atomically consumes shared quota before requesting mail.
Missing/invalid configuration, store failure, or exhausted quota sends no mail;
the eligible submission path retains a generic response independent of account
existence. The redirect is always `http://localhost:3000/auth/confirm`.
Dashboard allowlist/template configuration remains a separately approved manual
prerequisite; the switch does not configure it or authorize sending messages.

Validation for this stage: 37/37 Auth/unit/rendering/header tests, 74/74 local
pgTAP assertions, local concurrency tests, TypeScript, ESLint and production
build passed. New tests use real Next.js Set-Cookie output and path-aware cookie
identity, including an assertion that the old `/` deletion fails to remove
`/auth`. They are not full browser tests. No browser automation dependency is
installed, and no invitation/recovery emails were requested for this stage.
The local Auth/Mailpit harness gained exact deletion-header assertions for its
next separately approved run; its historical Stage 2D.6 result is unchanged.

On 24 October 2026, Stage 2D.9B deployed and verified the hosted private security
tables and four restricted RPCs. See
[the deployment result](./hosted-auth-security-deployment-result.md). The web
application is still not deployed, and hosted credential/email configuration
and real hosted invitation/recovery testing remain pending.

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
the address exists. This POST is **disabled in production** and requires the
exact localhost app origin. Hosted URLs are denied by default; only the explicit
Stage 2D.11 hosted-local-test gate permits the exact approved project during
development. An accidental local run against hosted Supabase cannot send
recovery mail without both server-only testing settings. The PostgreSQL limiter atomically allows three requests per
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
{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=invite
```

For **Reset Password**, use:

```text
{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=recovery
```

Review the final rendered links against the [Supabase template guidance](https://supabase.com/docs/guides/auth/auth-email-templates)
before saving. Keep **Authentication > URL Configuration > Site URL** at
`http://localhost:3000` for local testing. Add the exact
`http://localhost:3000/auth/confirm` to **Additional Redirect URLs** before
testing recovery. Do not add wildcards or the production domain until the
application is actually deployed there. These Dashboard changes have not been
made by this stage. Custom SMTP delivery remains unverified. The local Mailpit
recovery fixture still uses `RedirectTo` with the application's explicit exact
confirmation URL; the proposed hosted template above uses the fixed SiteURL
path so Dashboard-initiated messages do not depend on `RedirectTo` being supplied.

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
remains disabled until a server-only production store credential is configured,
a trusted application origin/enablement gate is reviewed, and hosted integration
plus SMTP delivery are verified. The security migration is now deployed. Before a real founder
invitation, review [platform-owner-provisioning.md](./platform-owner-provisioning.md).

For harmless local route checks, run `npm run dev`, visit
`http://localhost:3000/auth/confirm` without a token, and verify it shows a
generic invalid-link message. Visit `/auth/forgot-password` to inspect the
form, but do not submit a real mailbox until the controlled test is approved.
Run `npm run test:auth`, `npx supabase test db`, `npm run
test:db:concurrency`, `npm run typecheck`, `npm run lint`, and `npm run build`
for automated validation. The public recovery POST remains disabled pending
the server-only key, production origin/enablement review, and hosted integration
testing. Hosted Auth configuration and account operations require separate approval.

## Hosted invitation failure diagnostics

Stage 2D.22 verified the successful hosted invitation, password credential,
redeemed ticket and server sign-out state. See
[hosted success verification and logging caveats](./hosted-invitation-success-verification.md).
Framework development traces retained token-bearing request URLs even though
filtered terminal output was sanitized. Keep `.next/dev/trace` private and address
trace handling before further real invitations; never attach raw traces to reports.

Stage 2D.20 reproduced native browser forms sending Origin=null under no-referrer.
Forms now use a single user-initiated CORS-mode fetch with the same privacy
headers, followed by one validated navigation. See
[browser Origin and navigation results](./auth-origin-and-navigation-investigation.md).
Run `npm run test:auth:http` for the isolated real-browser/HTTP regression using
synthetic data only; do not use a real invitation to diagnose a local change.

Stage 2D.18 replaced request-derived origin checking with server-only
`AUTH_TRUSTED_ORIGIN` and strict Host/forwarded-header checks. See
[origin validation and regression results](./auth-origin-validation.md).
The localhost launchers configure the approved origin explicitly; other launch
methods must configure it before authentication POSTs are allowed.

See [Stage 2D.15 investigation](./hosted-invitation-failure-review.md) for the
original hosted failure evidence and remaining Dashboard Auth-log check. The
confirmation POST emits fixed `auth_confirmation` stage labels only; provider
errors, token-bearing URLs, form bodies, identities and cookies must never be
logged. A generic error page alone does not establish that `verifyOtp` failed.
