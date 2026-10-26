# Stage 2D.21: running authentication fix verification

Verified 26 October 2026 (Africa/Douala), project `onfxxtvfprjnqsxdmhkp`.
No real invitation token, hosted mutation, invitation resend or account operation
was executed. Existing private environment files were preserved.

## Running application

The existing Node listener was PID **32016** on `127.0.0.1:3000`. Its parent chain
included this workspace's hosted-test launcher. No restart or termination was
needed. The launcher sets the exact canonical origin `http://localhost:3000`,
loads the private same-project configuration and keeps recovery disabled.

A confirmation GET with a synthetic render-only token returned 200, the explicit
Continue form, and the Stage 2D.20 JavaScript-required Client Component markup.
No-store and no-referrer headers were present. The private, read-only Auth-store
readiness RPC passed against the linked project.

## Regression results

`npm run test:auth:http` passed again using real isolated Edge/HTTP fixtures and
the actual submission utility. It confirms:

- Native no-referrer forms reproduce Origin=null; corrected explicit CORS fetch
  preserves the browser Origin while still omitting Referer.
- Two concurrent calls send one POST; there is no automatic retry.
- The fixture has one final error-page GET per scenario, without a loop.
- Actual localhost Next.js proxy/handler checks accept the approved Origin gate,
  reject null/missing Origin and spoofed forwarded host, and reject the short
  dummy token before `verifyOtp`. Missing forwarded headers do not choose the
  trusted origin; Next.js's consistent defaults remain compatible.
- The actual error page repeatedly returns 200 without Location or refresh
  directives. Strict Origin/Host/forwarded validation remains enforced.

Unit tests additionally cover external/alternate-loopback Origins, conflicting
forwarded protocol and host, correct form parsing, failure without retry, safe
navigation destinations, session authorization and one-time ticket failures.
These checks do not establish successful hosted OTP/password processing.

## Sanitized logging

`npm run auth:hosted:logs -- --once` passed. The retained safe log visibly contains
`origin_reason_matched`, `origin_reason_header_null` and
`input_token_length_invalid` from known probes. For live viewing in VS Code:

```powershell
npm run auth:hosted:logs
```

Failure stages remain distinct:

| Category | Example fixed labels |
| --- | --- |
| Origin | `origin_reason_header_null`, `origin_reason_header_missing`, `origin_reason_forwarded_host_mismatch` |
| Input | `input_type_invalid`, `input_token_missing`, `input_token_length_invalid`, `input_field_count_invalid` |
| Provider verification | `otp_expired`, `otp_rejected`, `otp_request_failed` |
| Session | `session_verification_failed` |
| Ticket | `ticket_registration_failed` |

Provider/session/ticket failure differentiation is covered by mocked tests;
no real provider rejection was induced. Only fixed labels and elapsed timestamps
are shown. Do not print raw logs, cookies, keys, token values or live URLs.

## Existing disposable invitation

SELECT-only hosted verification at **01:59:32 Africa/Douala** found exactly one
matching account, UUID `f9df9fb7-7eae-40ff-abed-b497189ad46e`. It remained
unconfirmed with no password or sign-in, and zero profiles, role assignments,
sessions and flow tickets.

Its latest confirmation-send timestamp was **01:40:37 Africa/Douala on
26 October 2026**. With the owner-confirmed 3,600-second lifetime, expected expiry
is **02:40:37 Africa/Douala (01:40:37 UTC)** that day. At the database check it
was inside that expected window, with about 41 minutes remaining.

A new invitation was not required at that check. This is a timestamp/state
assessment, not a guarantee that the email token will verify: no token was read
or consumed. Recheck time immediately before any separately approved attempt.
After expiry, use the [same-identity replacement procedure](./hosted-replacement-invitation-preparation.md)
only with new explicit permission; do not delete/recreate the account.

## Validation and approval boundary

- Authentication tests: **60/60 passed**.
- Real Edge/browser and actual Next.js HTTP regressions: passed.
- TypeScript, ESLint and production build: passed.
- This stage created a verification record only; no application changes needed.

Next proposed action requires explicit approval for **one browser confirmation
attempt using the existing replacement invitation before the deadline**. Open a
new page from the newest message so the old native form is not reused, enable
JavaScript, keep the diagnostic viewer open, and click Continue once. Stop on
failure without reloading POST or sending another message. Expected labels are
one `form_received`, `origin_reason_matched`, then `confirmed` and the password
setup route. Password changes must remain within separately approved test scope.
No staff profile or role may be granted. If expiry passes first, request approval
for exactly one replacement to the same identity instead.
