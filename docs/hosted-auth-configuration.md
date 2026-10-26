# Stage 2D.10 — hosted authentication configuration readiness

Reviewed 24 October 2026 (Africa/Douala), project `onfxxtvfprjnqsxdmhkp`.
Stage 2D.24 update: the owner has reconfirmed both exact saved fragment links,
Site URL and redirect allowlist. This is owner verification, not a retrieved
template HTML check or a new email-delivery test. See
[privacy cleanup readiness](./auth-privacy-cleanup-readiness.md).
Stage 2D.23 supersedes earlier query-token email links with fragment links.
The examples below describe the required new links. The owner subsequently
confirmed the saved changes in Stage 2D.24; this code never updates hosted
templates automatically. See [trace privacy and checked sign-out](./auth-trace-privacy-and-sign-out.md).
For the 26 October origin correction and new required server-only canonical
origin setting, see [Stage 2D.18](./auth-origin-validation.md).
This is a preparation and code-review record. It authorizes no credential
retrieval/configuration, Dashboard change, email, account, or hosted data write.
Neither `.env.local` nor `.env.integration.local` was edited.

For the subsequent read-only hosted checks, confirmed localhost URL/provider
settings, the public-RPC/private-table compatibility analysis and the gated
invitation procedure, see [Stage 2D.12 verification](./hosted-auth-verification.md).

Stage 2D.13 prepared a separate ignored, owner-restricted credential file and
safe CLI check/localhost launcher. See
[hosted credential readiness](./hosted-auth-credential-readiness.md) for private
Dashboard entry instructions. The owner entered the credential privately and
the read-only readiness RPC passed against the approved hosted project.
None of those preparation commands create an account or request an email.

Stage 2D.11 subsequently corrected the flow-cookie path issue and added an
explicit, default-off hosted-recovery testing gate. The controls below describe
that corrected implementation; no hosted testing mode or credential was enabled.

The three migrations and restricted security RPCs were verified in
[Stage 2D.9B](./hosted-auth-security-deployment-result.md). Real local Supabase
Auth/Mailpit invitation and recovery passed in Stage 2D.6; that is not evidence
of hosted SMTP delivery or browser-level hosted session behavior. No hosted
settings were fetched again in this stage; previously observed settings must be
rechecked manually before any approved change.

## Credential boundary and manual setup after approval

| Variable | Purpose | Browser-visible? |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://onfxxtvfprjnqsxdmhkp.supabase.co` | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Publishable key for that exact project | Yes |
| `AUTH_FLOW_SIGNING_SECRET` | Cryptographically random server-side ticket signing/HMAC secret | No |
| `SUPABASE_AUTH_STORE_SECRET_KEY` | Same project's privileged Auth-flow RPC credential | No |
| `AUTH_RECOVERY_MODE` | `local` by default; `disabled` or explicitly approved `hosted-local-test` | No |
| `AUTH_RECOVERY_TEST_ORIGIN` | Exact `http://localhost:3000`, required only for hosted-test mode | No |

`src/lib/auth/supabase-auth-store.ts` imports `server-only`. Its environment
reference is not public; its client disables session persistence, refresh, and
URL session detection. Its only operations are the four fixed RPCs
`auth_flow_store_ready`, `register_auth_flow_ticket`, `redeem_auth_flow_ticket`,
and `consume_recovery_budget`. The module has no credential logging or credential
return value. The browser client receives only the public URL/publishable key.
The key itself remains broadly privileged at Supabase: the fixed interface does
not turn it into a narrowly privileged credential. Protect and rotate it as an
administrative secret.

Missing/placeholder/publishable store keys throw a generic configuration error.
Confirmation checks store availability and the signing secret before consuming
the email OTP. Password handlers catch failures and refuse changes; recovery
fails closed with a generic response. A failure after OTP verification but
before ticket registration can consume the email link; request a newly approved
link rather than weakening the ticket checks. Builds do not require this secret
until an operation executes. A successful build does not establish that the
hosted secret is configured.

After **explicit credential-configuration approval**, the operator should:

1. Open the exact [project Dashboard](https://supabase.com/dashboard/project/onfxxtvfprjnqsxdmhkp),
   then **Project Settings > API Keys**. Verify the project reference before
   selecting an existing server secret key (`sb_secret_...`). If none exists,
   creating one is a separate hosted configuration action requiring approval.
   Do not select a publishable key or a key from local `supabase status`.
2. Transfer the value directly into an approved server process/secret manager
   as `SUPABASE_AUTH_STORE_SECRET_KEY`. Never paste it in chat, shell arguments,
   command history, tickets, screenshots, or source files. Do not run a command
   that echoes environment values. Prefer a modern secret key; the existing
   backend also supports the legacy service-role JWT when explicitly approved.
3. For localhost hosted testing, use an explicitly approved, ignored environment
   file such as `.env.hosted-auth-test.local` or a process-scoped secret injector.
   Do not repurpose `.env.integration.local`, whose credentials are local-only.
   No such hosted test file or privileged value is created in this stage.
4. Configure a strong `AUTH_FLOW_SIGNING_SECRET` in that same server environment
   (at least 32 cryptographically random bytes). Keep one stable value across
   instances. Rotation invalidates active tickets and changes quota HMAC keys;
   plan it so quotas are not unintentionally reset during an active test.
5. Check the nonsecret target URL, restart the app in a fresh process, and verify
   the store-ready RPC returns true through a trusted server-only check. Do not
   add a public diagnostic endpoint or use a privileged client for staff reads.
   Staff authorization must continue through the user's SSR client and RLS.

Both existing environment files are Git-ignored and untracked. Build validation
also checks that the private store identifier/module does not enter the static
browser bundle. Inherited shell variables take precedence over dotenv files;
an approved future launcher must explicitly select the hosted test environment.
The existing local integration harness rejects hosted URLs and must stay local.

Reference: [Supabase API-key guidance](https://supabase.com/docs/guides/getting-started/api-keys).

## Exact proposed Dashboard settings and templates

Do not save any change until separately approved. In **Authentication > URL
Configuration**, retain Site URL **`http://localhost:3000`** and permit exactly
**`http://localhost:3000/auth/confirm`** under Redirect URLs. Do not add a
wildcard, a LAN host, or the production domain. Open email links on the same
computer running the app: `localhost` on a phone or another machine points to
that device. Keep signup/anonymous signup disabled, Email enabled, confirmation
enabled, and password minimum at least 12. Recheck these manually rather than
assuming old comparison results remain current.

In **Authentication > Emails > Templates** (some Dashboard layouts label this
**Authentication > Email Templates**), select **Invite user**, then replace its
HTML body with this proposed template. Suggested subject:
`BE WISE INNOVATIONS — Accept your invitation`.

```html
<h2>Accept your BE WISE INNOVATIONS invitation</h2>
<p>Continue only if you expected this invitation. Opening the link will not confirm it.</p>
<p><a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=invite">Review invitation</a></p>
<p>You will confirm on the website before choosing a password.</p>
```

Select **Reset password** and use this proposed body. Suggested subject:
`BE WISE INNOVATIONS — Password recovery`.

```html
<h2>BE WISE INNOVATIONS password recovery</h2>
<p>If you requested a password reset, continue to review and confirm it.</p>
<p><a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=recovery">Review password recovery</a></p>
<p>If you did not request this email, ignore it.</p>
```

These final localhost templates both use SiteURL plus the implemented path.
This avoids depending on whether a Dashboard-initiated message supplies
`RedirectTo`. With the reviewed Site URL, they render as:

```text
http://localhost:3000/auth/confirm#token_hash=<one-time-hash>&type=invite
http://localhost:3000/auth/confirm#token_hash=<one-time-hash>&type=recovery
```

The existing recovery template using `{{ .RedirectTo }}` remains compatible
with application calls that pass exactly `http://localhost:3000/auth/confirm`.
The local Mailpit fixture continues to test that explicit-redirect variant;
it has not been changed. Use the fixed SiteURL variant above for the proposed
hosted templates and visually review the rendered destination before sending.
Do not use `ConfirmationURL` as the action link or add privileged credentials,
user-metadata-driven URLs, link tracking, third-party assets, or analytics.

GET `/auth/confirm` renders an inert form. Only its explicit same-origin POST
to `/auth/confirm/complete` calls `verifyOtp` with the exact `invite` or
`recovery` type. Redirects are fixed to `/auth/set-password` or
`/auth/reset-password`; the browser cannot supply an external destination.
Responses are marked no-store/no-referrer/noindex, and the form has no automatic
submission. Ordinary email-link GET prefetch therefore does not consume the
token. These controls do not promise protection against a scanner that actively
submits forms. Keep passwords/tokens out of all request/response logging.

Reference: [template variables, scanners, and tracking](https://supabase.com/docs/guides/auth/auth-email-templates).

## Controlled SMTP delivery plan — not executed

1. Obtain separate permission to send one transport-only message to an actual
   mailbox the owner controls. Confirm the address privately, not in source
   control or chat. This is not permission to create an Auth user.
2. In **Authentication > Emails > SMTP Settings**, manually review the existing
   OVHcloud host, encryption/port, sender address/name and current quota without
   exposing the password. Verify sender-domain SPF/DKIM/DMARC configuration.
   Do not change credentials or settings under this preparation task.
3. If the Dashboard offers a genuine transport-only **Send test email** action,
   use it only after approval and verify it creates no Auth user. If unavailable,
   use the provider's own test facility if available, or stop and obtain separate
   authorization for an invitation test. Do not silently substitute an invitation
   or recovery request for a transport test.
4. Check inbox/spam, delivery time, sender, authentication results and whether
   the provider rewrites links. Disable tracking through a separately approved
   change if needed. Never forward a live authentication email for debugging.
5. On failure, inspect the project's **Logs > Auth** / Auth logs and the email
   provider's delivery/error records for the test timestamp. Record sanitized
   status/error code and request ID only. Distinguish SMTP authentication/TLS,
   sender rejection, recipient rejection, rate limits, and accepted-but-not-
   delivered results. Redact email addresses, invitation URLs, tokens, request
   bodies, headers and credentials before sharing. Do not paste a raw log export.
   The public recovery response is deliberately generic and cannot prove delivery.

References: [SMTP](https://supabase.com/docs/guides/auth/auth-smtp),
[Auth delivery troubleshooting](https://supabase.com/docs/guides/troubleshooting/not-receiving-auth-emails-from-the-supabase-project-OFSNzw).

## Approved disposable hosted-identity test procedure — not executed

Prerequisites: obtain explicit approval naming one owner-controlled disposable mailbox,
credential configuration, the reviewed Dashboard template/URL changes, logging
controls, and cleanup scope. Use a mailbox alias created for testing, never a
founder identity. Confirm **Authentication > Users** has no existing identity
for that address; an unexpected match stops the test.

1. Run the reviewed application on the tester's loopback interface at port 3000
   with the explicitly selected hosted URL/publishable key and approved
   server-only credentials. Prefer a production-mode localhost server for the
   invitation test (`npm run build`, then
   `npm run start -- --hostname 127.0.0.1 --port 3000`). No website deployment is
   implied. Stop other app instances to avoid target/cookie confusion.
2. Prevent query-string and body logging before opening real token links.
   Next.js development request logging may include a token-bearing URL; the
   local harness suppressed child-process output for this reason. Review
   server/proxy/telemetry logs, use no tunnel or public forwarding, and use a
   clean browser profile without extensions. Never export a HAR or cookie value.
3. After the one-account approval, use **Authentication > Users > Add user >
   Send invitation** (the administrative invitation action) for the exact
   approved mailbox, or a separately reviewed server-only
   `inviteUserByEmail` operation with `redirectTo` fixed to the confirmation URL.
   Record the actual Auth UUID privately. Do not use public signup, manually
   confirm the email, create a guessed password, insert a profile, or assign a role.
4. Capture delivery status in that real mailbox. Open the invitation on the
   local computer. Check the origin/path without copying the live URL. GET and
   refresh must show Continue without establishing a new session or consuming
   the email token. Click Continue once; POST must redirect to set-password.
5. Inspect browser cookie *attributes* and response headers only: `auth_flow`
   must have HttpOnly, SameSite=Lax, Path=/auth and a ten-minute limit. It uses
   Secure over HTTPS; localhost HTTP is a deliberate local exception. Supabase
   SSR session cookies preserve SDK defaults and are **not all HttpOnly**;
   browser JS may need them. Their presence is not staff authorization. Validate
   no-store/no-referrer and absence of third-party requests, then close DevTools
   without retaining token/cookie payloads.
6. Try a weak/mismatched password without consuming the ticket, then save a
   unique password meeting the hosted policy. The handler must clear the flow
   cookie, sign out the local session, and show pending activation. Confirm
   the old ticket and invitation cannot be reused. Successful password save
   does not imply a staff account.
7. Verify no team profile or assignment exists for the actual UUID. A separately
   reviewed, temporary local-only server harness must invoke the existing
   `getCurrentTeamMember`/`requirePermission` using a normal publishable-key
   session: expected null/access denied. No protected staff endpoint/UI exists
   yet; a 404 at `/internal` does not prove authorization. Do not create a public
   diagnostic endpoint or use the service-role client to test RLS.
8. Recovery against hosted Supabase is disabled by default. After separate
   approval, set `AUTH_RECOVERY_MODE=hosted-local-test` and
   `AUTH_RECOVERY_TEST_ORIGIN=http://localhost:3000` in the approved server-only
   test environment. Restart with a development server bound to `127.0.0.1`
   on port 3000 (visit `http://localhost:3000`). Review/suppress request logging
   before opening real token links. Do not use a public tunnel or managed host.
   The gate requires that exact app origin/Host, no conflicting forwarded
   headers, and the exact HTTPS project URL. Production runtime, known managed
   deployment/CI markers, wrong origin/project or missing settings always deny.
   The handler still requires valid public configuration, server credentials,
   signing secret, a ready store, and successful atomic quota consumption.
   It never trusts forwarded headers to choose the redirect. Keep production
   disabled. Do not bypass the limiter with a direct provider recovery call.
9. After the gate and email request are explicitly approved, submit the approved address through
   `/auth/forgot-password`. Confirm generic responses, real delivery, GET safety,
   recovery POST, reset-password, old-password rejection/new-password success,
   and ticket-replay denial. Verify three accepted requests per email/hour and
   the fourth generic-but-unsent request using private store metadata. Respect
   the hosted provider's resend interval; do not exhaust the global quota just
   to test it. Global concurrency already has real local PostgreSQL coverage.
10. Revoke/sign out the disposable sessions, then hard-delete only the reviewed
    test Auth UUID via the Dashboard/admin API after confirming its email/UUID
    pair. Confirm its ticket rows cascade away. If any staff profile/assignment
    unexpectedly exists, stop and investigate instead of deleting broadly.
    A reviewed privileged cleanup can remove only the test email's HMAC quota
    rows; never reset the global bucket or delete another user's records. Hourly
    quota windows expire logically, but rows are not automatically deleted.
    Retain provider/Auth audit evidence under the normal restricted retention
    policy; remove test messages and browser site data. Disable the temporary
    test gate, stop the app, and remove test credentials from the process or
    approved disposable secret environment. Verify no test identity remains.

Invitations create real hosted Auth records and send real mail. Links, browser
history and cookies are sensitive; protect the workstation and keep the test
short. Deletion is not an instant guarantee that an issued access JWT stops
working: unassigned users must remain unable to access staff data, and temporary
flows should be considered live until their JWT/ticket expiry. No test described
here grants founder access.

## Remaining security gates

- Credentials and template/URL changes require approval and verification.
- Hosted SMTP, browser session expiry/refresh, and full hosted integration remain
  untested. Local tests use real local Auth plus fetch cookie handling, not a
  full browser; the 27 unit tests are mocked.
- Ticket redemption is atomic and user/flow-bound. A password-update failure
  burns the ticket; require a new approved email link. A remaining authenticated
  Supabase session is not permission to skip the recovery ticket.
- Recovery quotas fail closed and use HMAC email/global keys, ignoring spoofable
  proxy IP headers. The 30/hour global fixed-window budget can be exhausted by
  abuse; provider limits, later ingress/CAPTCHA controls, monitoring and cleanup
  must be reviewed before public production use.
- TOTP availability/enrollment does not enforce MFA. Current staff authorization
  does not require AAL2; high-privilege operations need separately designed AAL2
  enforcement and identity-verified lost-factor recovery before rollout.
- SSR session cookies are browser-accessible under SDK defaults. Review XSS/CSP,
  HTTPS, request logging and refresh behavior before deployment. Only the
  temporary flow ticket is explicitly HttpOnly here.
- Cookie cleanup was corrected in Stage 2D.11: shared creation/deletion helpers
  use the exact host-only `auth_flow` identity at `/auth`. Terminal password
  responses clear it with Max-Age=0 and Expires at the epoch, preserving
  HttpOnly/SameSite/Secure attributes. Real Next.js Set-Cookie header tests and
  path-aware cookie identity checks pass; full browser storage verification
  remains part of the approved hosted test. Atomic redemption remains unchanged.
- There is no deployed login/dashboard or staff probe endpoint. Staff access
  requires an active database profile, assigned roles and server-enforced
  permissions; user metadata and an Auth account alone are insufficient.
- Define verified account recovery, session revocation, MFA factor replacement,
  operator approval/audit and emergency access procedures before founders depend
  on these accounts. No automatic owner bootstrap is allowed.

## Validation

Stage 2D.10: 27/27 mocked Auth tests, TypeScript, ESLint, and production build
passed. No hosted Auth call, message, account or data mutation was performed.
The private environment files remained unchanged. The post-build static-bundle
check found no private store variable/module references. This stage does not
claim that a hosted key or real hosted email flow is configured or working.

Stage 2D.11: 37/37 Auth/unit/rendering/header tests, 74/74 local PostgreSQL
assertions, local concurrency tests, TypeScript, ESLint and production build
passed. Path/expiry, wrong origin/project, production override denial, missing
signing/store configuration and rate-limit failure cases are covered. No full
browser runner is installed; these header tests must not be described as a
completed browser end-to-end run. No hosted changes, accounts or emails occurred.
