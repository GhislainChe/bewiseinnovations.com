# Stage 2D.22: successful hosted invitation verification

Verified 26 October 2026 (Africa/Douala), project `onfxxtvfprjnqsxdmhkp`.
This stage used read-only hosted queries. No token replay, password reset,
account mutation/deletion, role grant, email or deployment was performed.

## Confirmed account and authorization state

Hosted inspection at **02:11:41 Africa/Douala** verified:

| Check | Result |
| --- | --- |
| Matching disposable email accounts | Exactly one |
| Original UUID preserved | `f9df9fb7-7eae-40ff-abed-b497189ad46e` |
| Email confirmed | Yes, 02:03:40 Africa/Douala |
| Password credential configured | Yes, a database-side boolean check only |
| Ordinary Supabase Auth role | authenticated |
| Auth super-admin flag | false |
| Team profiles / role assignments | 0 / 0 |
| Assigned application permissions | 0 |
| Auth sessions | 0 |
| Unrevoked refresh tokens | 0 |
| Flow tickets | 1 total, 1 redeemed, 0 unredeemed/unexpired |
| Ticket redeemed | 02:04:05 Africa/Douala |

The password hash was never selected into client output, retrieved as a value,
printed or compared. The database evaluated only whether a credential exists.
No team access or administrative permissions were automatically granted.

## Sign-out and browser-cookie limits

Zero Auth sessions and unrevoked refresh tokens confirm the intended server-side
sign-out state after setup. The reviewed success path calls local-scope signOut,
expires the flow cookie with matching host-only `/auth` identity and applies SSR
cookie updates to the response. Existing tests verify the actual Set-Cookie
expiration attributes. The owner reported the success/pending-activation message.

Browser cookie absence cannot be inferred from database rows. A manual check was
requested: in the same browser's DevTools Application/Storage > Cookies for
localhost, report only whether `auth_flow` and the project's `sb-…-auth-token`
cookies remain, never their values. The owner subsequently confirmed **both are
absent** in the browser used for setup, without signing in or reopening the
invitation. Browser-side cookie cleanup is therefore owner-verified in addition
to the read-only server-side revocation checks.

Supabase [sign-out documentation](https://supabase.com/docs/guides/auth/signout)
states already-issued access JWTs can remain cryptographically valid until expiry
even after refresh/session revocation. This is not proof that any JWT remains in
this browser. Staff authorization still requires an active profile and assigned
database roles, both absent here.

Code-review follow-up: `changePasswordAfterConfirmation` currently awaits
`signOut` but does not inspect its returned `error` property. The verified zero
sessions/refresh-token state establishes success for this run; error-result
handling should be hardened and tested before relying on the success message in
future provisioning. No authentication code was changed in this verification stage.

## Invitation and ticket replay protection

Read-only state confirmed the invitation confirmation-token field is cleared and
there are zero remaining confirmation one-time-token records for this identity.
The exact token and its hashes were not queried from the hosted database.

The single flow ticket is redeemed. The deployed redemption function still
requires `redeemed_at is null` and a future expiry, and ordinary API roles lack
execution privilege. No ticket currently qualifies for reuse. This verifies the
stored replay-protection state and function predicate without calling redemption
or attempting OTP verification. Unit tests additionally cover replay denial;
no live replay was performed.

## Diagnostics and logging finding

Retained sanitized diagnostics include:

```text
[elapsed 00:36:38.138] auth_confirmation confirmed
```

This establishes verified session identity and durable ticket registration.
There was no dedicated historical password-save success label; password setup
is corroborated by credential presence, ticket redemption, server sign-out state
and the owner's observed success page. Do not fabricate a retrospective log event.

The retained filtered Next development console log had no detected known
server-key/signing-secret values, JWT-like values, token-assignment values or
password JSON values. Source review found only fixed-label authentication logging.
The production build trace also showed no such detected values.

**However, `.next/dev/trace` retained token-bearing request URLs.** An in-memory
scan found 276 occurrences of 56-character hexadecimal token query values. No
values were printed, copied into this report or replayed. These are framework
development traces, not the filtered terminal output; suppressing stdout alone
does not prevent their creation. Therefore this stage cannot claim that invitation
tokens were never logged. No password or configured server secret was detected
in the inspected traces, but pattern scans cannot prove absence from every
possible browser, provider, rotated or external log.

`.next` is Git-ignored. Keep the trace private: do not open/share raw trace output,
attach it to an issue or upload it to diagnostics. Its old/used tokens are no
longer reusable according to the checks above. No generated evidence file was
silently deleted or rewritten. Controlled local artifact cleanup and prevention
of token-bearing development tracing must be addressed before further real
invitations/founder provisioning. Do not weaken no-referrer, Origin validation
or replay protection to address this finding.

## Validation and cleanup boundary

- Authentication tests: **60/60 passed** (unit/mocked/rendering).
- TypeScript: passed.
- ESLint: passed.
- Production build: passed.
- No live credential, password or token replay tests were performed.

The completed hosted invitation/password/sign-out journey is supported by real
hosted state and the owner's browser cookie observation. Remaining items are
the local trace finding and sign-out error-result hardening for future flows. No stale usable
ticket or active hosted session currently blocks controlled account cleanup.

Cleanup is **not authorized by this verification**. It must target only the saved
disposable UUID after separate approval, preserve all real project data and
founder definitions, and separately cover private local trace/browser artifacts
as appropriate. No accounts or records were deleted here.
