# Stage 2D.14: controlled hosted invitation preparation

Prepared 24 October 2026 (Africa/Douala) for `onfxxtvfprjnqsxdmhkp`.
This preparation does not authorize account creation, email delivery or cleanup.

## Checks completed

- The linked reference and dedicated environment require the exact hosted project.
- The private file passed its Git exclusion, ACL, credential-format, signing-secret
  and recovery-disabled checks. The real server-side readiness RPC passed again.
- The supported read-only CLI configuration comparison completed. Saved invitation
  HTML is not verified by this check; Dashboard confirmation remains mandatory.
- The existing private launcher started Next.js on `127.0.0.1:3000` only. Use
  `http://localhost:3000`; do not use a tunnel or expose this listener publicly.
  Request logging is suppressed and recovery remains disabled.
- GET `/auth/confirm` returned the missing-link state. A synthetic, non-provider
  token rendered only the explicit POST confirmation form. No real token was used.
- GET `/auth/set-password` without a verified session/ticket showed the invitation
  guard. All three responses returned HTTP 200, `Cache-Control: no-store` and
  `Referrer-Policy: no-referrer`. These are route smoke checks, not hosted OTP tests.
- 41/41 mocked authentication/configuration tests passed. Existing implementation
  keeps privileged credentials behind `server-only`; no credential files changed.

## Mandatory owner confirmation before an invitation

In the exact project Dashboard, open **Authentication > URL Configuration**:

- Site URL: `http://localhost:3000`
- Approved redirect: `http://localhost:3000/auth/confirm`

Open **Authentication > Email > Templates > Invite user** (or **Email Templates**
in Dashboard versions using that menu). Confirm the saved invitation link is:

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Review invitation</a>
```

Do not use `ConfirmationURL`, tracking redirects, external assets or another
confirmation type. GET must remain inert; only the application's Continue POST
calls `verifyOtp` with `type: invite`. Do not change templates automatically.

The owner must provide ONE approved disposable email address, attest that its
mailbox is controlled and independently verified, and confirm it differs from
all four founders' intended accounts. Obtain explicit approval for exactly one
invitation and its Auth user creation. No password, key or token belongs in chat.

## Later approved browser journey (not executed here)

1. Recheck readiness and the listening localhost server. Confirm the recipient is
   not an existing account; stop rather than modifying an existing identity.
2. Through an approved administrative channel, invite only that recipient with
   redirect `http://localhost:3000/auth/confirm`. Do not assign a team profile/role.
   Record only the disposable Auth ID and sanitized delivery status. Do not blindly
   resend if the request times out: inspect the account and delivery status first.
3. Inspect the controlled mailbox, including spam. Review sanitized Supabase Auth
   delivery errors and OVHcloud delivery status on failure; never copy SMTP secrets
   or full token-bearing links into logs, screenshots or reports.
4. In a private browser on this Windows computer, open the email. Confirm the
   invitation form appears and reopening GET has not consumed it. Click Continue
   once, then set matching passwords of at least 12 characters.
5. Inspect cookie attributes locally without copying their values. Confirm the
   invitation session is established during setup and the flow cookie is removed
   at `/auth` on completion. The application deliberately signs out after password
   setup: a persistent signed-in session is not the expected outcome.
6. Confirm the neutral pending-activation result and denied staff authorization.
   There is no dashboard or general sign-in interface; a later approved server-side
   check can verify the unassigned Auth ID against existing authorization utilities.
   Do not add a public diagnostic endpoint or grant a role to test this.
7. Replay checks and cleanup require their approved scope. Before deletion, record
   the exact disposable Auth ID and confirm it has no staff profile/assignment.
   Obtain separate cleanup approval for that identity and its associated ticket
   records only; preserve unrelated security records and aggregate rate-limit data.

SMTP delivery, actual hosted OTP/session behavior and real-browser cookie cleanup
remain unverified. Recovery requests stay disabled. No accounts or messages were
created during this preparation. Existing `.env.local` and `.env.integration.local`
were preserved. Restart later with `npm run auth:hosted:dev` after readiness passes;
Ctrl+C stops that launcher's own process tree.
