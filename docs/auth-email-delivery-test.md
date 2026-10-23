# Stage 2D — Auth email delivery preparation

Target project: `onfxxtvfprjnqsxdmhkp`. This document prepares a delivery
test; it does **not** authorize an invitation, Auth user creation, password
recovery request, hosted setting change, or website deployment.

## Current URL state and delivery-only test

A read-only Supabase config comparison on 2026-10-23 found hosted Auth Site URL
`http://localhost:3000` and an empty additional redirect allowlist. The hosted
minimum password length now matches the local 12-character setting (no diff was
reported). The owner reports custom SMTP is configured with the company
OVHcloud mailbox; SMTP credentials, sender verification, template content, and
actual delivery cannot be confirmed through this read-only comparison.

**No callback is needed to test SMTP transport alone.** After separate approval,
an authorized Dashboard administrator should open the exact project, review
**Authentication > Emails > SMTP Settings** and the sender domain, and use a
Dashboard-provided **Send test email** action if available. Select an
independently verified mailbox controlled by the owner; do not put that address
in this repository or chat. Confirm arrival, sender/from address, SPF/DKIM/DMARC
alignment, TLS where reported, and spam-folder placement. Record only delivery
status and time. If Dashboard offers no non-account test message, use the
OVHcloud SMTP provider's own test facility, or stop and seek separate approval
for a test that creates an Auth user. Do **not** send an invitation merely to
test transport.

## Routes required for actual invitations and recovery

The routes below were subsequently implemented locally in Stage 2D.3, but have
not been deployed or tested end-to-end with an Auth user. Before any real
invitation or recovery email is sent, review and test:

- `GET /auth/confirm`: display a minimal, non-prefetching confirmation step for
  a one-time `token_hash` and an exact `type` of `invite` or `recovery`; do not
  verify the token on GET because mail scanners may prefetch links.
- `POST /auth/confirm/complete`: verify the one-time token with Supabase
  `auth.verifyOtp({ token_hash, type })` through a request-scoped SSR client,
  write session cookies with no-store headers, and redirect only to a fixed
  same-origin path for the selected flow. Do not log or reflect the token.
- An invitation password-setup route and a recovery password-update route,
  each requiring a fresh verified Auth session and appropriate one-time flow
  state. These limited routes now exist locally, but the full Auth/Mailpit
  integration test remains pending. Do not grant staff access until the
  separately approved profile/role binding exists.

For **PKCE flows that actually return a `code`**, a separate server callback may
use `exchangeCodeForSession(code)`. Do not assume an admin invitation link
returns a PKCE code: Supabase's server-side email-template guidance uses a
`token_hash` and `verifyOtp` for invite and recovery templates. Email scanners
can consume a one-time link if verification occurs on GET.

After those routes exist on an HTTPS deployment, set Dashboard
**Authentication > URL Configuration** to:

- **Site URL:** `https://bewiseinnovation.com` (only once that owned origin is
  deployed and serves the reviewed Auth flow).
- **Additional Redirect URLs:** the exact
  `https://bewiseinnovation.com/auth/confirm` and, only for a controlled local
  test, `http://localhost:3000/auth/confirm`. Do not use a wildcard, unrelated
  preview domain, or a URL that does not yet serve the callback.

Review **Authentication > Email > Templates** so invite and recovery links
target the reviewed `/auth/confirm` route with `{{ .TokenHash }}` and the exact
`invite` or `recovery` type; preserve the appropriate `{{ .RedirectTo }}`
behavior. Review the final rendered link before sending any mail. Do not paste
live links or tokens into issues, chat, analytics, or server logs. Supabase's
[email-template guide](https://supabase.com/docs/guides/auth/auth-email-templates)
and [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls)
describe the token-hash and allowlist requirements.

The first Platform Owner invitation still follows
[platform-owner-provisioning.md](./platform-owner-provisioning.md): verified
identity and email, separate approval to create the Auth user, acceptance,
then separately approved atomic profile/role/audit binding. A transport-only
mail test is not evidence that invitation acceptance or password recovery works.
