# Stage 2D.19: replacement invitation preparation

Reviewed 26 October 2026 (Africa/Douala), project `onfxxtvfprjnqsxdmhkp`.
Preparation only: no invitation, account creation/deletion, password reset,
role assignment, migration or hosted configuration change was executed.

## Application verification

- The existing localhost process served both authentication pages successfully.
  `/auth/confirm` without a token showed the missing-link guard;
  `/auth/set-password` without a verified session/ticket showed the invitation
  guard. Both responses were HTTP 200 with `Cache-Control: no-store`.
- A one-character dummy-token POST with the approved localhost Origin reached
  `origin_expected_localhost`, `origin_reason_matched`, then `input_rejected`.
  It did not call `verifyOtp`. The redirect stayed on the canonical localhost
  origin. This confirms the running handler includes the Stage 2D.18 correction.
- The launcher explicitly configures `AUTH_TRUSTED_ORIGIN=http://localhost:3000`;
  the observed matching result confirms the running process accepts that exact
  origin. Recovery remains disabled. No private environment file was changed.
- The real, read-only Auth-store readiness RPC passed against the exact project.
- `npm run auth:hosted:logs -- --once` recovered current safe labels and elapsed
  timestamps. Run `npm run auth:hosted:logs` in a separate VS Code terminal for
  live labels. Next's generated logs are subject to rotation; record only safe
  labels/timestamps during the approved browser test, not raw logs or URLs.

## Existing account verification

SELECT-only hosted checks at **01:34:01 Africa/Douala** on 26 October found:

| Check | Result |
| --- | --- |
| Matching disposable email accounts | Exactly one |
| Auth ID | `f9df9fb7-7eae-40ff-abed-b497189ad46e` |
| Email | Matches the already approved disposable mailbox |
| Email confirmed | No |
| Password set | No |
| Last sign-in | None |
| Sessions / flow tickets | 0 / 0 |
| Team profiles / role assignments | 0 / 0 |
| Last invitation / confirmation sent | 24 October 2026, 02:49:16 Africa/Douala |

The original invitation has expired under the owner-confirmed 3,600-second
setting. A retained token field does not extend validity; its value was not
selected or disclosed. Do not submit the old email link again.

## Supported replacement method: verified, not assumed

The hosted read-only Auth health endpoint reported **v2.197.0**. The official
source for that exact tag was reviewed:

- The invitation handler finds a user by email and audience before creating one.
- For an existing unconfirmed identity, it reuses that user and calls `sendInvite`.
- It creates a user only if none exists; an existing confirmed user is rejected.

Therefore the supported server-side administrative
`auth.admin.inviteUserByEmail` operation can issue a replacement invitation to
this existing unconfirmed identity. **Deletion/recreation is not necessary.**
This is a version-matched implementation review, not a claim that a second hosted
invitation was already tested. No invitation endpoint was called in this stage.

References: [Auth v2.197.0 invitation implementation](https://github.com/supabase/auth/blob/v2.197.0/internal/api/invite.go),
[official administrative invitation API](https://supabase.com/docs/reference/javascript/auth-admin-inviteuserbyemail).
The ordinary [resend API](https://supabase.com/docs/reference/javascript/auth-resend)
does not provide an `invite` resend type; do not substitute signup/recovery.

## Hosted email configuration: confirmed versus pending

The supported linked CLI configuration comparison completed for the exact
project and reported no URL-setting differences from the approved local
declaration. The owner previously confirmed the saved Dashboard settings.
Saved invitation HTML is not available through that CLI comparison, so current
manual reconfirmation remains requested before sending a replacement:

- **Authentication > URL Configuration**: Site URL `http://localhost:3000`;
  approved redirect `http://localhost:3000/auth/confirm`.
- **Authentication > Email > Templates > Invite user**: saved link must be
  `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`
  (`&amp;` is the equivalent separator in HTML).
- Use the existing SMTP configuration; delivery of the original invitation was
  owner-confirmed. Delivery of a replacement is not yet tested.

Do not modify hosted templates, URL settings, SMTP credentials or expiry here.

## Exact sequence after separate approval

1. Obtain explicit approval for **exactly one replacement invitation** to
   `hndstudy2026@gmail.com`, preserving the Auth UUID above, with no roles/profile.
   Confirm the saved template/URLs first and keep the localhost app running.
2. Repeat readiness and read-only identity checks immediately before sending.
   Assert the same UUID, email, unconfirmed status and no staff assignment, plus
   exactly one matching email account. Stop if any check differs.
3. Ensure no concurrent administrative account deletion/provisioning is occurring.
   This API is email-addressed, not an atomic UUID-bound resend: if someone deletes
   the identity between checks and the request, the API can create a new user.
   This limitation must not be hidden or worked around with direct SQL.
4. Through the private administrative client, issue exactly one call:

   ```typescript
   // Proposed only; not executed by this documentation.
   const result = await admin.auth.admin.inviteUserByEmail(verifiedExistingEmail, {
     redirectTo: "http://localhost:3000/auth/confirm",
   });
   ```

   The email must come from the verified existing identity; do not hardcode any
   password or credential. Use a new local private attempt journal that preserves
   the original one and prevents accidental reruns. Do not call `createUser`,
   `generateLink`, signup, recovery or SQL user mutations as a fallback.
5. Assert the returned UUID equals `f9df9fb7-7eae-40ff-abed-b497189ad46e`, then
   read back that UUID and confirm one matching account and an updated invitation
   send timestamp. Record only sanitized status, ID and send time. On an error,
   timeout or mismatched UUID, stop and inspect read-only; do not retry or delete.
6. Treat older messages as superseded. Ask the owner to use only the newest
   invitation, promptly within its verified lifetime, on the same computer.
7. In a private browser, open one localhost tab. GET should render Continue without
   consuming the token. Click Continue once; do not double-click or refresh POST.
   Watch for one `form_received`, category labels, `origin_reason_matched`, then
   `confirmed` and `/auth/set-password`. If any failure occurs, stop and record
   only the label names and elapsed timestamps. Never export the full Network log.
8. Password setup and subsequent inspection must stay within the approved browser
   test scope. Successful setup intentionally signs out and shows pending
   activation; it does not create a team profile or grant access. Cleanup requires
   separate approval and is not part of this replacement preparation.

## Validation and remaining gates

Authentication tests: **53/53 passed**. TypeScript, ESLint and production build
passed. No account fixtures or real tokens were used for these checks.

Remaining gates are current manual saved-template/URL reconfirmation and explicit
approval for one replacement invitation, followed by the controlled browser test.
No account recreation or deletion approval is needed for the proposed supported
path. If the account state changes, stop and review a new plan rather than
automatically deleting or recreating it.
