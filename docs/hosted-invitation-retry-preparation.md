# Stage 2D.16: controlled invitation retry preparation

Project: `onfxxtvfprjnqsxdmhkp`. Prepared 24 October 2026 (Africa/Douala).
No invitation, verification, account mutation or cleanup was performed.

## Existing identity and invitation

Read-only hosted checks at 02:21:50 UTC (03:21:50 Africa/Douala) found exactly one
account for the approved disposable mailbox. Its Auth ID remains
`f9df9fb7-7eae-40ff-abed-b497189ad46e`.

- Unconfirmed email; null last sign-in timestamp; no password set.
- Zero sessions, flow tickets, team profiles and role assignments.
- Confirmation token present, queried as a boolean only.
- Invitation and confirmation-send timestamp: 24 October 2026, 01:49:16 UTC
  (02:49:16 Africa/Douala). Age at inspection: 1,954 seconds (32m 34s).

The owner read the hosted Dashboard and confirmed **Email OTP Expiration = 3600
seconds**. Based on the recorded send time and that setting, expected expiry is
**24 October 2026, 02:49:16 UTC / 03:49:16 Africa/Douala**. At 02:24:37 UTC
(03:24:37 local), approximately 24m 39s remained. This is a time-sensitive
assessment, not a promise that the token remains valid later or that the original
mail contains the currently stored token. Definitive validation would consume it
and was not attempted.

**Decision: the existing invitation is a reasonable candidate for ONE separately
approved confirmation retry before that deadline. A replacement is not currently
shown to be necessary.** If the deadline passes, do not attempt the old link;
prepare one replacement for the same identity after separate approval. A later
`otp_expired`/`otp_rejected` result is also a stopping condition, not permission
to resend automatically. Do not increase expiry or change Auth settings.

## Diagnostic and localhost readiness

The existing app remains bound only to `127.0.0.1:3000`, accessed through
`http://localhost:3000`. Token-free confirmation and password pages returned 200,
guarded missing-invitation states and `Cache-Control: no-store`. The actual app
startup previously emitted `auth_preflight ready`; the private standalone
readiness RPC passed again during this stage. Recovery remains disabled and
existing environment files were not edited.

The launcher terminal visibly emitted `auth_confirmation form_received` and
`auth_confirmation input_rejected` for one newly issued one-character dummy
submission. That probe stopped locally; it did not invoke `verifyOtp`.
Currently retained logs contain three `form_received` events, each paired with
`input_rejected` or `origin_rejected`, attributable to the known diagnostic probes.
They do not show accidental real-token submissions or successful confirmation.
The original attempt predates useful stage logging, so historic duplicate
submissions cannot be excluded conclusively.

## Next browser test, only after approval

1. Recheck the current time against the deadline and confirm
   `auth_preflight ready`. Keep recovery disabled. If expiry has passed, stop.
2. Open one private browser window on this computer, using the existing email
   link and **localhost**, not the IP address. Do not copy the link into chat,
   terminals, screenshots, recordings, log exports or external URL scanners.
3. GET should display Accept invitation and Continue. Do not use multiple tabs,
   double-click Continue, refresh a submitted POST or accept form resubmission.
4. Click Continue exactly once. Record only the ordered fixed terminal labels
   and the resulting route name. A single `form_received` is expected. If two
   appear, stop and record timestamps; do not submit again.
5. If `/auth/set-password` appears, the invitation session and one-time ticket
   were established. Proceed with password setup only within its separately
   approved test scope. Never share password/cookie values. Completion should
   clear the flow cookie, sign out and display pending activation, with no role.
6. On any error, stop. Record only these safe label names and timestamps:

| Label | Meaning |
| --- | --- |
| `origin_rejected`, `body_size_rejected`, `content_type_rejected`, `form_parse_failed`, `input_rejected` | Local request rejected before OTP verification |
| `client_configuration_failed`, `store_configuration_failed`, `signing_configuration_failed`, `store_check_failed` | Prerequisite failure before OTP verification |
| `otp_request_failed` | OTP call threw; outcome can be uncertain and needs read-only inspection |
| `otp_expired`, `otp_rejected`, `otp_result_incomplete` | OTP rejected or incomplete response; inspect sanitized Auth status/code |
| `session_verification_failed`, `ticket_registration_failed` | OTP succeeded but a later operation failed; do not assume token remains reusable |
| `confirmed` | Session verified and durable one-time ticket registered |

No terminal label or generic error page independently authorizes another attempt.

## Replacement procedure, if needed and separately approved

1. Obtain explicit approval for exactly one replacement invitation to the same
   verified disposable mailbox; no new identity, roles or settings changes.
2. Read the existing account by its saved UUID and confirm its email, unconfirmed
   state, original UUID and unique email match. Stop if absent, changed, confirmed
   or assigned staff access. Ensure nobody else is deleting/provisioning that
   identity during the operation.
3. Use the trusted administrative `auth.admin.inviteUserByEmail(existingEmail,
   { redirectTo: "http://localhost:3000/auth/confirm" })` once. Supabase Auth's
   invitation implementation reuses an existing unconfirmed email identity.
   The operation is email-addressed, so preflight is essential: it can create a
   user if the existing identity has disappeared. Do not use createUser,
   generateLink, signup, password reset or raw SQL to replace the invitation.
   `auth.resend({ type: "invite" })` is not a supported invite API.
4. Assert the response UUID equals the saved UUID and recheck that only one
   account matches. A different UUID, error or timeout is a stop: inspect state
   read-only; do not retry, delete anything or repair manually.
5. Record sanitized status and the new send timestamp; use only the newest mail.
   Treat older links as superseded. Protect any local attempt journal against
   automatic re-execution; preserve the original invitation record.

References: [Supabase invitation API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail),
[Auth invitation implementation](https://github.com/supabase/auth/blob/master/internal/api/invite.go),
[supported resend types](https://supabase.com/docs/reference/javascript/auth-resend).
Hosted implementation versions may differ; verify returned identity on execution.

## Approval boundary

No further action is authorized by this document. The next proposed action is
**one browser confirmation POST using the existing invitation before 03:49:16
Africa/Douala on 24 October 2026**, contingent on explicit approval and a fresh
time/readiness check. If that window is missed, request approval for exactly one
replacement invitation to the same existing identity instead. Cleanup remains
separately gated. This stage changed documentation only.
