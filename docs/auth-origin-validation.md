# Stage 2D.18: explicit authentication origin validation

Reviewed 26 October 2026 (Africa/Douala). No invitation, account, password,
hosted schema, data or Auth setting was changed.

## Defect and evidence boundary

Previously `formRequestFailure` called `sameOrigin(request.url, Origin)`, making
Next.js's request URL the implicit trusted browser origin. It did not consult a
canonical origin setting, Host, or forwarded-header consistency. Next.js's
installed `next-server.js` can construct its initial URL from `fetchHostname`
(the bind hostname) and port. Other layers, including NextRequest's loopback
normalization, can change the resulting hostname. A bind URL is therefore an
unsuitable source of browser-origin configuration.

The captured incident proves local `origin_rejected` before `verifyOtp`. Its
original headers were intentionally not stored, so the exact original mismatch
(missing Origin versus a differing hostname, scheme or port) is unrecoverable.
We do **not** claim the historical POST definitely compared localhost with the
IP. Current probes report localhost for both the request URL and Host. The
internal-IP/browser-localhost case is reproduced explicitly in regression tests.

## Canonical origin configuration

All authentication POST guards now use server-only `AUTH_TRUSTED_ORIGIN`.
The restricted hosted-test launcher and local integration-test launcher explicitly
set it to `http://localhost:3000`. Existing private environment files are not
edited. For ordinary `npm run dev`, configure this non-secret variable privately
in the appropriate development environment, following `.env.example`.

The value must be exactly a serialized origin, with no path, trailing slash,
query, fragment or credentials. HTTPS is required except for HTTP loopback in
development outside managed/CI deployment. Missing or invalid configuration
denies authentication submissions. Production must configure its actual HTTPS
browser origin after deployment; no deployment is performed here.

| Input | Treatment |
| --- | --- |
| Expected origin | Explicit server configuration only |
| Origin header | Required; exact equality with the configured origin |
| Host | Required; exact equality with the configured authority |
| Request URL | Diagnostic category only; never selects the expected origin |
| X-Forwarded-Host | Optional; if present must exactly match configured authority |
| X-Forwarded-Proto | Optional; if present must exactly match configured scheme |
| Forwarded lists/conflicting proxy headers | Rejected; never used to select a trusted origin |
| Standard Forwarded header | Not used to select the expected origin |

The alternate loopback hostname is not an alias in the allowlist: approving
localhost does not approve an Origin of 127.0.0.1. Correct deployment proxies must
preserve canonical Host and consistent forwarded values; arbitrary forwarded
headers do not grant access. CSRF, token verification, sessions, durable ticket
redemption and staff authorization remain enforced.

Auth redirects also use the configured canonical origin, preventing internal IP
or arbitrary Host values from determining the destination. Invalid configuration
produces a fixed relative `/auth/error` redirect; cross-origin redirect targets
are rejected.

## Diagnostics

Only fixed labels report Origin present/absent, expected-origin category,
request Host and request URL host categories, and a match/mismatch reason.
Examples: `origin_header_present`, `origin_expected_localhost`,
`origin_request_host_localhost`, `origin_reason_matched`,
`origin_reason_header_missing`, `origin_reason_forwarded_host_mismatch`.
No raw Origin/Host/forwarded header, URL, query token, password, cookie or key is
included. The existing terminal filter/viewer whitelists these labels.

Use `npm run auth:hosted:logs` in a VS Code terminal to follow safe events.
The verified workspace server was restarted after explaining the need to load
the new process environment; recovery stayed disabled. Startup reported ready.

## Validation

- 53/53 authentication/configuration tests passed. New coverage includes trusted
  localhost with an internal IP request URL, wrong loopback Origin, missing/null
  or malicious Origin, conflicting Host/forwarded values, fail-closed config,
  legitimate form POST validation, canonical redirects and sanitized diagnostics.
- TypeScript, ESLint and production build passed.
- Actual localhost dummy POSTs showed `origin_reason_matched` followed by
  `input_rejected` for the approved Origin; a one-character dummy value prevents
  reaching `verifyOtp`. Other probes showed missing/header/forwarded-host rejection.
- The first approved probe timed out during cold compilation. A bounded repeat
  after compilation passed. No real token or account was involved.
- The real local invitation harness was updated with canonical origin configuration
  but was not executed: this stage prohibits creating/deleting accounts.

This verifies the origin guard, not a fresh hosted invitation journey. The old
24 October invitation must not be retried now; a future attempt requires its own
approval and a valid invitation. No hosted email was sent during these checks.
