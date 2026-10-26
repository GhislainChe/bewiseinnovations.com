# Stage 2D.15: hosted invitation failure investigation

Reviewed 24 October 2026 (Africa/Douala), project `onfxxtvfprjnqsxdmhkp`.
The owner confirmed delivery of the one approved disposable invitation and an
error after Continue. No invitation was resent during this investigation.

## Evidence and limits

Read-only PostgreSQL inspection of that specific disposable Auth ID found:

- Email confirmation and last sign-in timestamps were null; no password was set.
- There were zero sessions and zero Auth-flow ticket records for the identity.
- The confirmation-token field remained populated. Its value was never selected
  or printed; only presence was queried. This indicates it was not cleared by
  successful confirmation, but does not establish that the token is still valid.
- No Auth audit rows were returned. This is not proof that no `/verify` HTTP
  request occurred; Auth request logs are a separate source.

The privileged read-only readiness RPC passed. The current localhost listener's
process ancestry includes the restricted hosted-test launcher, which validates
the exact project, private file permissions, generated signing-secret format and
disabled recovery before spawning Next.js. Browser and request-scoped server
clients share the same public environment configuration. No environment files
were changed. The running process's secret values were not inspected or printed.

Local development logs contained hydration warnings, but no historical provider
response or confirmation-stage evidence. The warning alone does not establish
the cause of the POST failure. A later launcher attempt also encountered the
already-running app; it was not evidence of a failed invitation request.

Two malformed, one-character dummy-token POSTs demonstrated that the localhost
Origin passes the form gate and the alternate IP Origin is rejected. Both stop
before `verifyOtp`. Thus a localhost/IP origin mismatch was not reproduced.

Source review confirms GET only renders a form; POST passes the token hash and
exact `invite` type to `verifyOtp`. The saved Dashboard template was previously
confirmed by the owner. There is no evidence proving a scanner or duplicate POST
consumed the invitation. No real token was fetched, replayed or verified here.

**The original root cause remains unproven.** Current records support failure
before successful verification, rather than a successful verification followed
by failed ticket registration. Expiry, rejected input, a transient prerequisite
failure or provider rejection cannot be distinguished retrospectively yet.

## Safe diagnostic improvement

The POST handler and confirmation operation now emit only fixed labels under
`auth_confirmation`: form/input/client/store configuration rejection, signing
configuration failure, store check failure, OTP request failure, `otp_expired`,
other OTP rejection, incomplete OTP result, session verification failure, ticket
registration failure, or confirmed. Unknown provider codes map to a fixed label.
No request body, URL, token, cookie, identity, arbitrary error code/message or raw
provider object is logged. Public responses remain generic. Client configuration
failure now also produces a controlled generic redirect rather than an uncaught
error. Authorization, same-origin checks and one-time redemption are unchanged.

Regression tests distinguish failure before OTP consumption from provider
rejection and post-verification session/ticket failure. These are mocked tests,
not a fresh hosted invitation test. The dummy route checks produced the expected
`input_rejected` and `form_rejected` labels in local logs without contacting Auth.

## Remaining evidence and retry decision

The owner subsequently checked the displayed hosted Auth logs: `/invite` returned
200, but no `/verify` entry was found around the attempt. This makes the local
pre-verification gates the primary investigation path; log visibility alone
still does not prove which gate failed. The original stage was not recorded.

The localhost launcher previously discarded all child terminal output. It now
forwards only exact, whitelisted `auth_confirmation` and `auth_preflight` labels;
all other stdout/stderr remains suppressed. Local-only Node startup
instrumentation validates the actual Next.js process's project, disabled recovery,
public client configuration, signing secret, privileged-client configuration and
read-only store RPC. Its observed result after restarting the verified workspace
process was **`auth_preflight ready`**. There is no diagnostic HTTP endpoint and
no OTP verification, ticket registration, quota mutation or hosted write in the
startup probe. The probe is disabled in production and managed/CI environments.
Readiness requests have a ten-second abort timeout.

Request diagnostics now distinguish `form_received`, `origin_rejected`,
`body_size_rejected`, `content_type_rejected`, `form_parse_failed` and
`input_rejected`. Unexpected form parsing errors receive the same controlled,
generic redirect. This does not relax any request checks. A fresh real-token
attempt remains unauthorized; no historical failure stage can be reconstructed
from the currently successful startup probe.

In this project's Dashboard open **Logs > Auth** (or **Logs Explorer > Auth logs**)
at the time of the original Continue click. Inspect whether `POST /verify` appears,
its status and error code. Share only those fields, or that no request appears;
never share raw log entries, URLs, headers, tokens or credentials. Management-log
API credentials were not configured in the process or standard token files, so
these hosted request logs could not be inspected programmatically here. Do not
introduce privileged credentials merely to avoid this manual check.

Whether a fresh invitation is required remains conditional on those logs and the
configured invitation lifetime. A retained token does not rule out expiry. An
expired/rejected token will require separate approval for another invitation;
even an apparently unused link must not be retried without that approval. Do not
create another identity, reset its password, delete it or assign it any roles.

## Validation

Subsequent terminal recovery found a newer captured submission ending in
`origin_rejected`, before `verifyOtp`. See
[terminal diagnosis and safe VS Code viewer](./auth-diagnostic-terminal.md).
This identifies that newer failure's stage, not the unlogged original attempt.

- Authentication/configuration tests: 45/45 passed (mocked/unit/rendering),
  including fixed-label log filtering and request rejection reasons.
- Local PostgreSQL pgTAP: 74/74 passed across both suites.
- TypeScript, ESLint and production build passed.
- No hosted writes, invitations, password resets, account deletions, role grants,
  Auth setting changes or migrations were performed in this investigation.
