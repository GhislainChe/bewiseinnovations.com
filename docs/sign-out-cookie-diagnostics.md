# Stage 2E.9 — opt-in sign-out cookie diagnostics

These diagnostics investigate the remaining localhost auth cookie. They do not
fix or establish its cause. No hosted sign-in, sign-out, refresh or session
revocation was performed during implementation. Existing private environment
files are unchanged. Recovery remains disabled.

## Enabling and disabling

Disabled by default. In the VS Code PowerShell terminal that will launch the
reviewed localhost server, set:

```powershell
$env:AUTH_COOKIE_DIAGNOSTICS = '1'
npm run auth:hosted:dev
```

Do not launch a second server over an existing listener. Arrange an approved
restart of only the identified development process if one is already running.
The launcher inherits this server-only switch without changing private dotenv
files. It still binds to 127.0.0.1 and sets the trusted browser origin to
http://localhost:3000. Diagnostics also require NODE_ENV=development and are
refused in production, test runtime, CI, Vercel, Netlify and Cloudflare Pages.
This is a diagnostic gate, not permission to deploy development mode publicly.

In another VS Code terminal:

```powershell
npm run auth:hosted:logs
```

To disable, stop the identified launcher normally, then remove the switch before
the next launch:

```powershell
Remove-Item Env:AUTH_COOKIE_DIAGNOSTICS -ErrorAction SilentlyContinue
```

Environment changes do not disable an already-running process. No restart was
performed as part of this implementation.

## Event meanings and limits

Each line contains only `auth_cookie`, a random UUIDv4 request ID, a fixed phase
(`sign_out` or `auth_other`) and one allowlisted event. The viewer adds Next's
elapsed log timestamp. No URLs, cookie names/values, account IDs, credentials,
provider errors, request bodies or headers are serialized.

- `proxy_request_cookie_present/absent`: cookie-name presence before proxy SDK
  activity on the sign-out path.
- `request_cookie_present/absent`: cookie-name presence at the sign-out handler.
  Only the configured project's exact base auth cookie and numeric chunks count.
- `sign_out_succeeded`: SDK returned no error with a matching incoming cookie.
  This alone is not proof of remote revocation or browser cookie removal.
- `sign_out_missing_session`: SDK returned no error and no matching cookie was
  supplied. This denotes missing cookie-backed session input, not a separate
  provider-verified diagnosis. Invalid/stale cookie contents are never inspected
  for diagnostic classification; their presence does not prove a valid session.
- `sign_out_failed`: returned SDK error or thrown route/client failure. No raw
  error is logged. `form_rejected` is logged separately before SDK invocation.
- `response_deletion_present`: the handler response includes host-only root-path
  expiry instructions for all matching incoming cookie names/chunks. Absent or
  incomplete instructions produce `response_deletion_absent`. No additional
  deletion is performed by instrumentation.
- `proxy_cookie_write/deletion`: proxy attempted a matching auth-cookie write or
  root deletion. `proxy_no_cookie_write` means no matching write occurred.

Proxy overwrites any incoming correlation header with a generated ID and passes
it upstream as a request header, never as an authorization credential or browser
response header. Proxy and handler events for one request share an ID. Navigation
and parallel requests get new IDs; use timing and the preserved browser Network
sequence to investigate later writes. IDs do not link identities across requests.

Response metadata is observed before Next's final proxy/header merge and browser
application. Thus logs cannot establish the final wire headers or browser result.
SDK error handling, local-scope sign-out, CSRF checks and refresh behavior are
unchanged. No speculative proxy bypass or forced cookie purge was added.

## Separately approved controlled browser test

Do not execute until approval covers one controlled test using only the existing
disposable identity. No role, MFA-factor or account changes are part of this test.

1. Open Chrome DevTools → Network **before** the approved login/sign-out sequence.
   Enable **Preserve log**. Keep the safe log viewer open. Do not export a HAR or
   record screenshots/raw headers; recordings can contain credentials and cookies.
2. Complete only the approved login/MFA checkpoint privately. In the same browser,
   open `/auth/sign-out` and click Sign out once. Do not retry uncertain results.
3. Locate POST `/auth/sign-out/complete`. Record only status, whether Request
   Cookies lists the project auth-cookie name/chunks, whether Response Cookies
   marks each deleted/expired, and whether Chrome reports a cookie rejection.
   Do not copy values, bodies or raw headers.
4. With the JavaScript form the expected POST is HTTP 200 JSON, followed by a
   navigation to `/auth/error`. Native submission instead uses a redirect. Record
   the observed sequence and any later responses setting that cookie using only
   presence/deletion booleans and fixed path names, never query strings.
5. Compare proxy/handler events sharing the request ID. Check later `auth_other`
   proxy events for writes; a write alone does not establish it arrived last.
6. In Application → Cookies, report only whether auth_flow and base/chunked auth
   cookies remain, plus Domain/Path/expiry metadata if needed. Do not delete them
   manually, reload auth pages or submit another sign-out without direction.
7. Stop at this checkpoint. Any read-only hosted session inspection is separate;
   no additional revocation or account mutation is authorized by diagnostics.

## Local verification

`npm run test:auth` includes diagnostic gates, strict output filtering, cookie
name/scope/expiry classification and five isolated SDK/route/proxy scenarios:
cookie supplied, cookie missing, SDK failure, proxy refresh then deletion and
proxy no-write. Every HTTP call in these scenarios is mocked with synthetic
credentials and fails rather than contacting a real service. These are not
hosted-browser tests and do not reproduce the reported cookie persistence.

Validation for this instrumentation: **78/78 authentication tests passed**,
including the five mocked SDK/route/proxy scenarios inside one integration
regression test. TypeScript, ESLint and production build passed. No new
cookie-persistence defect is confirmed. The initial new test runner required
an async main wrapper for this repository's CommonJS transform; that fixture
issue was corrected and the full suite rerun successfully.
