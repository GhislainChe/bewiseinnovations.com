# Stage 2D.20: browser Origin and navigation investigation

Reviewed 26 October 2026 (Africa/Douala). No hosted mutations, token verification,
invitation resend, password reset, account creation/deletion or role grant occurred.

## Confirmed browser-specific defect

Authentication pages correctly set `Referrer-Policy: no-referrer`. Their native
HTML POST forms, however, use a browser request mode in which that policy makes
the browser serialize Origin as **null**. Strict validation then rejects it.
Node fetch probes that manually set Origin did not model this browser behavior.
Changing the canonical origin alone could not solve this interaction.

An isolated real Edge test reproduced the exact application pattern:

| Submission | Origin category | Referer present |
| --- | --- | --- |
| Native form POST under no-referrer | null | No |
| Explicit CORS-mode fetch under no-referrer | Expected local origin | No |

See the [Fetch standard's Origin algorithm](https://fetch.spec.whatwg.org/#append-a-request-origin-header).
The old browser request's raw header was not retained, so we cannot retroactively
assert its literal value. This is a confirmed reproducible defect in the same
submission mechanism, consistent with the browser's `header_mismatch` result.

The guard still rejects null/missing/external Origins and conflicting forwarded
headers. It now distinguishes `origin_reason_header_null`. No proxy-header
allowlist was broadened; forwarded headers cannot choose the trusted origin.

## Separating deliberate probes from the browser click

The retained records with differing reasons are not one inconsistent click:

- Elapsed 00:00:54–00:00:55: known wrong-loopback, missing-Origin, external-Origin
  and spoofed-forwarded-host diagnostic probes from Stage 2D.18.
- Elapsed 00:01:15–00:01:16 and 00:06:36: approved-origin probes with the
  deliberately one-character dummy value; these reached `input_rejected` because
  the existing minimum token length is 16. They never called `verifyOtp`.
- The later elapsed 00:14:23 captured submission ended at `header_mismatch`,
  before parsing/verification. There is no evidence that the real invitation
  token caused the earlier `input_rejected` labels.

GET and POST now share confirmation input validation. Missing/invalid type,
missing token, invalid length and duplicate expected fields get distinct fixed
labels without values or lengths. Malformed links no longer render a usable form.

## Fix and duplicate protection

All four authentication forms share a small Client Component. GET remains inert.
Only the user's submit event triggers a fetch with:

- explicit `mode: cors`, so the browser provides its authentic Origin;
- same-origin credentials and `referrerPolicy: no-referrer`;
- no-store, a bounded timeout, and `redirect: error`;
- URL-encoded fields compatible with existing strict server parsing;
- a synchronous one-attempt latch and disabled submit button. Concurrent clicks
  and network uncertainty do not cause another request.

The server's existing canonical redirect helper supports an `x-auth-form: 1`
response-format flag: after the same existing validation and operations, it
returns JSON containing a fixed destination instead of an HTTP redirect. This
flag grants no access and bypasses no guard. SSR session and flow cookies still
apply to that response. The browser accepts only approved same-origin auth
destinations, then performs one `location.replace` navigation. It never follows
a chain of fetch redirects or automatically retries a POST. Ordinary HTTP
callers retain the existing 303 behavior.

JavaScript is required for these secure forms. Before hydration the button is
disabled and a noscript explanation is available. No effect automatically submits
or navigates. A newly rendered form after a server validation response can accept
a correction; one-time redemption remains enforced by PostgreSQL, not the button.
The same browser defect affected password setup/reset/recovery forms, so the
shared fix covers them too. Hosted recovery remains disabled.

## Repeated navigation: what was and was not established

Source review found no redirect cycle: proxy calls getClaims and returns
NextResponse.next; it does not issue navigation redirects. The error page renders
static status and a user-activated link. Its link now disables prefetch to reduce
unrelated requests. There is no reload timer or navigation effect in these routes.

Real HTTP tests through the current Next.js proxy repeatedly returned 200 for
`/auth/error`, with no Location or refresh directive. The browser fixture observed
one final error-page GET per scenario and only one POST for two concurrent calls
to the actual submission utility. No loop was reproduced.

The historical reported visual refresh remains **unproven**: retained logs do not
contain enough browser navigation evidence to attribute it to double clicks,
browser behavior or development tooling. [Next.js Fast Refresh](https://nextjs.org/docs/architecture/fast-refresh)
can reload pages during source edits, but this is not claimed as the incident's
verified cause. Do not edit sources or run builds while a future approved browser
journey is underway. If activity recurs, collect only route categories, counts,
timings and whether the browser classifies requests as navigation or tooling;
never export token-bearing URLs, request bodies, cookies or a complete HAR.

## Tests and limits

- **60/60 authentication/unit/rendering tests passed**, covering explicit fetch
  options, duplicate attempts, failure without retry, blocked external/looping
  destinations, input classification, JSON destinations and stable error rendering.
- `npm run test:auth:http` **passed** using installed Edge with disposable local
  profiles, an isolated local HTTP fixture and the actual TypeScript submission
  utility. It reproduces native Origin=null, verifies corrected Origin/no-referrer,
  duplicate suppression and stable navigation. It also tests the real localhost
  Next.js proxy/handler with only missing/null/spoofed headers and short dummy input.
- TypeScript, ESLint and production build passed.
- Browser profiles are under ignored `.supabase/browser-tests/`. No hosted test
  account, mailbox message or real token is used by the test command. The script
  requires the local app and an installed supported Windows Edge/Chrome executable.

The full hosted invitation/password journey has not been retried. Existing ticket
redemption, session isolation, rate limits, CSRF and no-store/no-referrer remain.

## Is a fresh invitation needed?

A read-only check found the same test identity still unconfirmed with no sign-in
timestamp. The replacement send timestamp remains 26 October 2026, 00:40:37 UTC.
Under the owner-confirmed 3,600-second lifetime its expected expiry is **02:40:37
Africa/Douala / 01:40:37 UTC** that day. At the investigation's 01:52:28 local
time check, expiry had not passed. An origin rejection does not consume the token,
so a fresh invitation is not inherently necessary before that deadline. This is
not proof that the email's token is valid; no token was examined or consumed.

No further real-token attempt is authorized by this stage. After the deadline a
fresh invitation requires separate explicit approval. Any approved test must use
the updated rendered page, not an old already-open native form. Stop on any
failure without reloading a submitted POST or sending another email.
