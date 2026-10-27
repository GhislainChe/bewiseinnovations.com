# Stage 2E.9 — disposable invitation and primary-MFA checkpoint

Project: **onfxxtvfprjnqsxdmhkp**. Scope: the one expressly approved disposable
mailbox, one invitation and unassigned-account testing only. The verified email
and new UUID are tracked privately in `.supabase/hosted-mfa-stage-2e9/`, not in
this report. No founder identity, staff profile or role binding is authorized.

The user has prepared an encrypted KeePassXC database and an entry named
**BE WISE — MFA Test**. This is a functional single-computer test. It does not
establish independent-device security or owner recovery readiness. This stage's
explicit primary-only scope supersedes the earlier proposed two-factor test:
**no backup enrollment, role assignment or deletion is authorized**.

## Current checkpoint

### Controlled sign-out diagnostic test — passed

On 27 October 2026 the user performed the single approved login/MFA/sign-out
journey with Chrome Network Preserve log enabled. The user reported AAL2 after
the challenge. The initial AAL1 display was not separately reported, so that
particular observation is not newly claimed as passed here.

The one sign-out POST's generated correlation ID matches these retained safe
events, in order: `proxy_request_cookie_present`, `proxy_no_cookie_write`,
`request_cookie_present`, `sign_out_succeeded`, `response_deletion_present`.
The next navigation request logged `auth_other proxy_no_cookie_write`.
Chrome reported POST HTTP 200, the auth cookie present on the request and a
zero-lifetime deletion instruction on the response. The displayed message was
"You have been signed out." The user then found the Supabase auth cookie absent
without reloading auth pages, logging in again or deleting cookies manually.

Read-only hosted inspection at **11:43:38 UTC (12:43:38 Africa/Douala)** compared
exact session IDs with the privately saved pre-sign-out baseline. Exactly the
new session created during this test was absent; no new session appeared. One
older session remained unchanged and was not revoked. The confirmed identity
and verified-factor metadata remained unchanged, with zero profiles and role
assignments. Session removal and SDK success corroborate sign-out; no replay of
a captured JWT or refresh token was attempted. Previously issued access JWTs
can have a remaining lifetime; this is not a claim of immediate cryptographic
invalidation of every issued access token.

The earlier cookie-persistence symptom was **not reproduced**. No later proxy
cookie write was observed through the captured checkpoint. This does not prove
the historical cause or exclude every possible future race. No speculative
authentication correction is warranted from this successful test.

Safe event summaries and before/after session metadata were preserved privately
under the Git-ignored stage directory. The identified diagnostic launcher and
its children were stopped after capture; no listener remains on port 3000.
The opt-in flag existed only in that process environment, not private dotenv
files or permanent settings. Subsequent ordinary launches remain off by default.
No additional sign-out, unrelated session revocation, role binding, factor
change or identity cleanup was performed. Await separate instructions.

### Remaining auth cookie — investigation, not resolved

Controlled diagnostic test preparation: the identified older hosted-test
development launcher and its children were stopped and replaced with one
loopback-only instance with the opt-in cookie diagnostics enabled for that
process. The linked target and read-only Auth-store readiness passed. An
anonymous confirmation-page GET returned 200 with no-store/no-referrer; the safe
viewer showed `auth_preflight ready` and `auth_other proxy_no_cookie_write`.
No controlled sign-in or sign-out has yet been performed. Awaiting the user's
confirmation that Chrome Network recording and Preserve log are enabled before
the single authorized login/MFA/sign-out journey. Diagnostics must be disabled
when that test ends; no private environment file was edited.

Opt-in, development-only sign-out/proxy instrumentation and a controlled Network
procedure are now documented in [sign-out cookie diagnostics](./sign-out-cookie-diagnostics.md).
No hosted browser retry was performed. The earlier missing-cookie/idempotent
success behavior remains observable; no new persistence root cause is confirmed.

Latest diagnosis-only review rechecked the sign-out route, SSR response adapter,
proxy refresh path and browser-client usage. No confirmed implementation defect
has yet reproduced the browser symptom, so no speculative authentication change
was made. The authentication suite was rerun: **73 passed, zero failed** (mocked
and rendering tests; not a new hosted sign-out or browser-cookie test).

The original browser Network recording has been requested, if still available,
using only request-cookie presence, response deletion metadata, HTTP status and
navigation destination. No raw headers or cookie values are needed. With the
JavaScript form, the expected response is HTTP 200 JSON followed by navigation
to `/auth/error`; native submission instead uses a redirect. Neither the success
message nor a surviving cookie name establishes session validity.

The minimal next diagnostic, if the original recording is unavailable, is
value-free correlation of request cookie presence, provider outcome, final
response deletion metadata and proxy cookie writes during a separately approved
attempt. Do not add a refresh bypass or change cookie scope without evidence.
No hosted request that signs out, refreshes or revokes a session was performed
for this latest review.

After the success message, the user checked Chrome's localhost cookie jar:
`auth_flow` was absent, the base `sb-onfxxtvfprjnqsxdmhkp-auth-token` cookie
was present, and no `.0`/`.1` chunks were visible. They report no subsequent
login or manual deletion. **Browser auth-cookie cleanup: FAILED by observed
presence**, rather than passed from the success message. Presence alone does
not prove the cookie contains a usable session; its value was not inspected.

Read-only inspection at **16:36:47.467 UTC, 26 October 2026** found the same two
AAL2 session rows as at 16:24. The factor ID/status and zero profiles/assignments
also remain unchanged. No additional session was revoked and no hosted account
or factor was modified by this investigation.

Reviewed the actual sign-out POST, route cookie adapter, proxy, installed
Supabase SSR/Auth source and installed Next.js cookie/proxy documentation.
The implementation calls local-scope sign-out, checks the returned error,
applies SDK cookie changes to the final response, and separately expires
`auth_flow` at `/auth`. Supabase's session-cookie defaults are root path `/`,
host-only domain and SameSite=Lax; no application domain/path override is used.
The proxy calls getClaims on all matched auth routes and can refresh cookies.
The stable error/status page itself has no browser Auth client or refresh loop.

Three **synthetic, in-process diagnostic cases** passed using the real route,
SSR adapter and SDK against a fully mocked Auth service. No dotenv credentials,
real cookie, hosted token or real network was used:

| Case | Observation |
| --- | --- |
| Valid synthetic session supplied to sign-out | Mock logout called; root auth cookie deletion emitted with empty value and Max-Age=0; flow deletion at /auth |
| Expired synthetic session through proxy then sign-out | Mock refresh/user/logout executed; proxy emitted a refreshed cookie and the route emitted root Max-Age=0 deletion |
| No auth cookie in the request | No logout call, yet SDK/handler reported success; only flow-cookie deletion was emitted |

The first diagnostic attempt lacked development runtime in its synthetic
fixture and was correctly stopped by Origin validation; correcting the fixture
did not alter application CSRF checks. Evidence from that incomplete attempt
was not treated as a sign-out result. No production code was changed.

These cases validate the adapter's instructions, **not** the full live Next.js
wire response, browser application of Set-Cookie, cookie-scope matching or a
concurrent-request race. They do not reproduce the reported browser symptom.
The no-cookie case identifies a limitation of interpreting the success text:
idempotent sign-out success does not establish that a previously visible browser
cookie was delivered to the route or removed. It is not evidence that the real
request was missing its cookie.

Root cause is **UNDETERMINED**. Plausible causes requiring evidence include a
different cookie Path/Domain, a cookie not sent to this handler, or a later
refresh response recreating it. Do not declare a refresh race or scope mismatch
confirmed. The user was asked only for Domain, Path, Session/future-expiry
classification and whether another localhost auth tab/window was open. No
Value, screenshot, HAR, raw header or request body was requested. The user
subsequently reported **Domain localhost, Path /, expiry
2027-11-30T16:21:32.421Z**, no other localhost authentication tab/window, and
no reload, repeat sign-out or manual deletion. This matches the expected
domain/root path; a simple path mismatch is not supported by these observations.
The metadata does not reveal the host-only flag or actual request/response
cookie headers, so it is not proof of delivery or scope matching on the wire.

Subtracting the installed SDK's default 400-day lifetime gives an inferred set
time of **2026-10-26T16:21:32.421Z**, close to the recorded 16:21:32–16:21:33
MFA challenge activity. This suggests the remaining cookie originated around
that activity, **if** the default lifetime was used. It does not establish its
contents, validity, which session it represents, or response-arrival order.
It is not evidence of a fresh post-sign-out login. Absence of another tab makes
that particular refresh source less likely but does not exclude an in-flight
request in the same tab.

The current confirmed discrepancy remains that a long-lived auth cookie is
present despite the reported success message. Root cause is still unproven;
do not broaden deletion, change cookie scope, revoke sessions or assert a
framework bug based on this alone. A future controlled diagnostic should record
only whether the actual sign-out request included the cookie and whether its
final response emitted the matching expiry instruction, correlated with any
proxy writes. Never capture raw Cookie/Set-Cookie headers or cookie values.
No repeat sign-out/login or next hosted test is requested here. Private metadata
is recorded in `browser-cookie-metadata.json`.

Private diagnostics: `diagnose-signout-cookies.ts` and
`synthetic-signout-cookie-diagnostics.json` in the protected stage directory.
Only cookie names/options and empty/nonempty booleans were recorded; synthetic
cookie/token values were not printed. The synthetic result is not a new hosted
integration pass. Further functional MFA tests remain paused until this cleanup
discrepancy and the retained sessions are reconciled. No blanket cookie purge,
session revocation, server restart, account deletion or speculative fix occurred.

### Browser sign-out report and hosted reconciliation

The user reports clicking Sign out once in the same browser, seeing **“You have
been signed out.”**, and no subsequent login/code. Browser-reported sign-out:
**PASSED**. Cookie cleanup remains **PENDING** until the browser checks presence
only; server-side SQL cannot inspect that cookie jar.

Read-only inspection at **16:24:08.888 UTC on 26 October 2026** found one of
the two baseline session IDs absent (the session created at 12:36:38.939),
and the 12:34:01.355 session still present. It also found an additional AAL2
session created at **16:20:57.321 UTC**, linked to the same verified factor,
and an additional successful challenge at **16:21:33.084 UTC**. Two AAL2 session
rows therefore remain; this is not complete account-wide session cleanup.

The prior snapshot predates this additional activity, and the current browser's
session ID was not collected. The missing older session is observed, but it
cannot conclusively be attributed to this particular click. Do not infer that
the new session/challenge happened after sign-out or that the user made an
unreported action; the sign-out time/context is not independently correlated.
The cause of that intervening activity remains unresolved. Hosted current-
browser-session revocation attribution is **PENDING**, not an unconditional
pass or a confirmed application defect. No automatic revocation was performed.

The exact confirmed identity, sole verified factor ID, zero profiles and zero
assignments remain unchanged. Private evidence is retained in
`sign-out-checkpoint-review.json` and the refreshed enrollment-history review.
Only metadata was queried; no cookie, token, seed or password was retrieved.

**Next manual checkpoint only:** in that same browser, inspect localhost:3000
cookies through DevTools Application/Storage → Cookies. Report only whether
`auth_flow` and `sb-onfxxtvfprjnqsxdmhkp-auth-token` (including chunked suffixes)
are present or absent. Do not copy values, send screenshots, sign in or submit
another code. Pause further challenge/login tests until the session discrepancy
is reconciled. This checkpoint changes no factors, roles, users or sessions.

### Incorrect-code result and next manual checkpoint

The user reports one deliberately incorrect six-digit submission, the generic
MFA failure message, assurance remaining AAL2, and no subsequent valid code or
sign-out. Read-only verification at **15:24:26.869 UTC, 26 October 2026** confirms
no additional successful challenge: three new challenges since the saved
baseline have `verified_at = null`, while the three previously verified
challenges and two existing AAL2 session identities/assurances remain unchanged.
The same verified factor ID remains, with zero profiles or assignments.

**Incorrect-code rejection: PASSED, corroborated within this evidence.**
Remaining AAL2 is expected for a previously elevated session; it does not prove
AAL1 elevation protection. The database contains **three** new unverified
challenges (15:19:07.975, 15:19:26.051 and 15:20:34.903 UTC), although the user
reports one submission. Exactly one browser request is therefore **not proven**;
do not attribute all three to that click or assert automatic retries without
request-level evidence. Retain this discrepancy for review before further
challenge testing. No secret or code was read, and no repeat was requested.

Private result: `incorrect-code-result.json`. The next checkpoint is one
user-initiated sign-out in the current browser, followed by a stop and report
of the resulting message. Do not sign in or submit another code yet. Existing
sign-out is local-scope, so read-only verification must distinguish the current
session's removal from complete cleanup of both recorded sessions. No session
revocation was performed by the assistant in this checkpoint.

Latest functional-test authorization permits remaining unassigned-account MFA
tests and sign-out/revocation of **only this disposable identity's test
sessions**. It does not permit factor changes, role binding or account deletion.
It supersedes earlier statements requiring another session-revocation approval
for this same bounded test scope; those historical statements remain below.
Manual user checkpoints still apply, and uncertain seed attribution remains.

Read-only baseline refreshed **26 October 2026 at 15:06:59–15:07:31 UTC**:
same confirmed UUID, one unchanged verified factor, zero profiles/assignments/
effective permissions, two AAL2 session rows and three previously verified
challenges. Private `functional-before-incorrect-code.json` preserves factor,
session and challenge references before the next browser action. No browser
JWT was collected and no session was revoked by these checks. The existing
loopback development listener remains on 127.0.0.1:3000.

**Next user checkpoint:** open /auth/mfa in the existing browser context. If it
still reports AAL2 and pending activation, select the existing verified factor
and explicitly submit one privately chosen incorrect six-digit code once. Do
not enroll another factor, sign out or submit a valid code yet. Report only the
result message and visible assurance. If unauthenticated or unexpectedly granted
staff access, stop and report that state instead. An already-AAL2 session may
remain AAL2 after rejection; this does not establish AAL1 elevation protection.
Incorrect-code rejection, fresh AAL1 login, subsequent challenge and sign-out/
cookie cleanup remain **PENDING**, not passed. These steps have not run yet.

| Item | Status |
| --- | --- |
| Exact project / four migrations / preserved security catalog | PASSED |
| Pre-invitation Auth users / profiles / assignments | PASSED — all zero |
| Hosted Auth configuration and owner-confirmed fragment template | PASSED |
| Protected hosted-test credential/signing-secret readiness | PASSED |
| Localhost application and sanitized diagnostic readiness | PASSED |
| Disposable identity creation and private UUID record | PASSED — SDK returned the new UUID; recorded privately |
| Invitation request | PASSED — Supabase accepted exactly one request; receipt still pending |
| Actual mailbox delivery | PENDING — recipient must confirm |
| Password setup / confirmed identity / preserved UUID | PASSED — exact recorded UUID/email, confirmed identity and password-presence boolean verified read-only |
| KeePassXC preparation | PASSED — user-reported preparation only |
| Verified TOTP enrollment and challenge | PASSED functionally — one verified TOTP and matching AAL2 sessions; screenshot exposure remains a security hold |
| AAL2 and unassigned staff-access denial | PASSED within the existing status/authorization boundary — no profile, role or effective permissions |
| Fresh password-only AAL1 denial / subsequent challenge / invalid code rejection | PENDING — not executed in this read-only checkpoint |
| Checked sign-out / session revocation / browser cookie cleanup | PENDING — not attempted |

The invitation helper updates only the two request-result rows after a successful
single administrative invitation response. Receipt, password/MFA and sign-out
rows must not be marked passed before actual user action and verification.

## Read-only verification after the user's KeePassXC checkpoint

Observed **26 October 2026, 12:42:37.977 UTC** using an explicitly read-only
transaction against the exact linked project and the private invitation UUID.
No password hash, factor seed, cookie, JWT or invitation token was retrieved.

- The original UUID still matches exactly one approved email identity. It is
  confirmed, has a password configured (database-side boolean only), and has the
  ordinary authenticated Auth role. No other Auth user exists.
- Exactly **one verified TOTP factor** exists, created at **12:34:11.953 UTC**
  and updated at **12:37:15.887 UTC**. Its ID is tracked privately.
- **Two AAL2 sessions** exist, created at **12:34:01.355 UTC** and
  **12:36:38.939 UTC**. Both match this user's verified factor and have valid
  session lifetimes at inspection. Session rows corroborate the reported AAL2
  browser status; no browser JWT was collected to inspect its individual expiry.
  Both sessions remain present. Their count is not proof of compromise, but
  needs reconciliation with the user's sign-ins/browser contexts before final
  session cleanup. No session was revoked or refreshed by this inspection.
- There are **zero profiles, assignments and effective staff permissions**.
  The user reports the real MFA page's pending-activation message, which the
  existing GET status handler derives from caller-scoped getCurrentTeamMember.
  Code review plus the live database absence corroborate denial. No dashboard
  exists; no separate authenticated privileged HTTP operation or private
  permission harness was executed. Do not claim those nonexistent tests passed.
- The invitation ticket is redeemed: **one ticket, one redeemed, zero usable**.
  No token was replayed. There are no other-user tickets, public audit rows or
  Storage objects. Two quota rows exist, consistent with the shared/email
  sign-in store; there was no initial row-level quota snapshot to establish
  every increment's provenance.
- The entire scoped security catalog equals the pre-invitation snapshot except
  the authorized Auth-user count changing from zero to one. All four migrations,
  eight protected tables, prior/new policies, function definitions, inspected
  grants, 4 roles / 18 permissions / 31 mappings and exact permission sets are
  unchanged. No unintended application/catalog changes were observed. This is
  not an exhaustive historical audit of every managed Auth/provider record.

Private evidence: `mfa-readonly-review.json`, `after-mfa-catalog.json` and
`mfa-checkpoint-summary.json` inside the protected stage directory. The reviewer
helper selects only factor/session metadata, never their secret columns.
No new account, invitation, factor, assignment, revocation or deletion occurred.

### Enrollment-history follow-up — current conclusion

The user subsequently clarified that the screenshot showed an earlier setup
key, they signed out and back in, a different key was generated, and KeePassXC
was configured with that new key before successful verification. This replaces
the earlier “Unsure which enrollment” description below. The account history
will not be requested repeatedly, and no screenshot or secret comparison is
needed or permitted for this check.

Read-only inspection at **13:15:03.518 UTC on 26 October 2026** found:

- The exact recorded confirmed identity remains, with no other Auth users,
  team profiles or assignments.
- Exactly one current TOTP factor is verified. Its ID is the same as in the
  preceding snapshot; creation is **12:34:11.953 UTC**, last update
  **12:37:15.888 UTC**. No older/unverified factor row is currently present.
- Three retained challenges for that same factor have verified timestamps:
  **12:36:06.836**, **12:36:53.843** and **12:37:16.195 UTC**. Challenge OTP
  columns, encrypted seeds and token values were not selected.
- The same two AAL2 session rows remain, linked to that factor. No factor
  rotation, session revocation, sign-out or cleanup was performed.
- The query of `auth.audit_log_entries` by this exact account's standard
  `payload.actor_id` returned **zero matching rows**. No raw audit payload,
  email, IP address or other private log bodies were retrieved. This does not
  establish that all provider logs are empty; external Auth logs were not
  independently inspected here.

**Conclusion:** the current factor is positively identified and verified, but
retained database metadata cannot prove that it is the newer of two historical
enrollments or identify the photographed key. There is no captured earlier
factor ID/event to compare with it. Absence of an old factor row cannot alone
prove abandonment, removal or which setup was exposed. The user's clarified
sequence supports the abandoned-enrollment explanation; it is not independent
catalog evidence of that provenance. A different displayed setup key also is
not grounds to retrieve or compare the stored seeds.

Supabase Auth's
[v2.197.0 verification implementation](https://github.com/supabase/auth/blob/v2.197.0/internal/api/mfa.go)
contains deletion of unverified same-type factors after successful verification,
which is a possible explanation for missing older rows. The tag matches the
cached linked Auth version; this is source context, not a new live build
attestation or proof that such cleanup occurred for this account.

Private evidence: `enrollment-history-readonly.json` and
`review-enrollment-history.mjs` in the existing protected stage directory.
Previous evidence remains preserved. No hosted writes occurred.

### Remaining tests and safety scope

Functional enrollment/challenge success remains passed. Current-factor exposure
is **unresolved, not confirmed**. The previous precautionary rotation proposal
below remains optional separately approved remediation of that uncertainty;
no automatic rotation is required or authorized by this read-only result.
Do not describe the factor as proven unexposed, independently secured, or
suitable for founder/privileged activation.

Safe remaining work is confined to this disposable unassigned account:

- Read-only assurance/factor status and pending-activation/staffAccess denial
  can be checked without staff binding. Do not copy browser tokens/cookies to
  chat or add a public diagnostic endpoint.
- A bounded user-driven invalid-code rejection check and a fresh password-only
  AAL1 → valid challenge → AAL2 sequence can test functional behavior. They
  would create Auth challenge/session records and were **not executed here**.
  An already-AAL2 session remaining AAL2 after a bad code does not demonstrate
  that an AAL1 user was denied elevation.
- Sign-out/session and cookie cleanup remains pending. Under the latest
  instruction, obtain separate explicit approval for any session revocation
  or sign-out before executing that sequence. Reconcile both existing sessions;
  ordinary local sign-out must not be presented as global session cleanup.
- Respect the three-per-email sign-in quota, stop on uncertain results and
  never reset counters to complete a test.

No second factor, rotation, account deletion, staff assignment, permission-
positive test, owner bootstrap or recovery enablement may proceed without its
own authorization. Single-computer KeePassXC testing still does not establish
independent-device or owner-recovery security. This checkpoint ends at the
report; no browser interaction, code challenge or session mutation is initiated.

### Historical exposure assessment and unexecuted rotation proposal

The following assessment preceded the clarification and metadata review above;
its unresolved provenance is now recorded there. The rotation procedure is a
proposal only, not an instruction or permission to execute it.

The user reports that an earlier screenshot exposed a setup secret. That image
is not available for safe attribution in this checkpoint, and neither the
image nor a seed should be supplied again. **No seed comparison was attempted**.
There is only one current factor. If the screenshot was from this same account's
enrollment and no intervening replacement occurred, it identifies this current
factor by enrollment history. The user subsequently answered **“Unsure which
enrollment.”** Attribution therefore remains unestablished. Treat the current
factor as potentially compromised and require replacement before trusting it
for further security acceptance. This is a precaution, not proof that the
current factor's seed appeared in the screenshot. No rotation or session
revocation is authorized by that answer.
Functional AAL2 success does not establish factor secrecy. Removing a screenshot
or waiting for a six-digit code to expire does not rotate the underlying seed.

Proposed procedure, **not executed and requiring a separate exact approval**:

1. Confirm the affected account and recorded old factor from metadata/enrollment
   history only. Reconcile the two existing sessions. Do not use this disposable
   factor for founder provisioning, staff activation or other accounts.
2. Approve replacement enrollment, verification, targeted removal of the old
   factor and expected session effects as one reviewed rotation scope. This
   intentionally needs a temporary second factor, which current authorization
   does **not** permit. It is replacement, not approval for a backup-factor test.
3. While authenticated at AAL2, explicitly enroll one replacement using the
   existing setup page. Store its new secret privately in a separate temporary
   KeePassXC entry so the current entry is not overwritten prematurely. Verify
   the new factor and keep all setup material out of screenshots, logs and chat.
4. Use a reviewed own-identity AAL2 unenrollment flow for the **exact old factor**
   after the replacement is verified. The current UI does not implement removal;
   a reviewed supported procedure/tool is a prerequisite, not an instruction
   to paste arbitrary SDK code into DevTools. Supabase's
   [unenroll API requires AAL2 for a verified factor](https://supabase.com/docs/reference/javascript/auth-mfa-unenroll).
5. Under that same separately approved scope, reconcile/revoke old sessions,
   perform checked sign-out and a fresh password/AAL1 login, then challenge only
   the replacement and verify live AAL2, continued staff denial and cookie
   cleanup. Enrolling/verifying a replacement can affect other sessions;
   [Supabase documents these enrollment effects](https://supabase.com/docs/reference/javascript/auth-mfa-enroll).
   Do not imply continuity of all sessions or revoke them silently.
6. Verify only the replacement remains. Retire the old KeePassXC TOTP material
   privately after successful replacement; any screenshot/artifact cleanup
   needs its own exact approval. Do not delete security audit history or the
   test identity. Retain sanitized rotation approval/outcome metadata.

There is no factor removal, session revocation or rotation approval in this
checkpoint. If the old factor is definitely unrelated, record the non-secret
reason and verify that attribution before lifting the hold. This remains a
single-computer KeePassXC test, not independent-device security or a completed
recovery rehearsal. No application code, policy, credential or environment file
was changed. No new browser challenge or sign-out test was performed.

## Completed pre-invitation checks

- Fresh bounded read-only hosted catalog matches the reviewed deployment:
  migrations `20261021010000`, `20261021010100`, `20261023010000`,
  `20261026010000`; 4 roles, 18 permissions, 31 mappings; no Auth users, profiles
  or assignments. A final Admin API list additionally must return zero users
  immediately before the invitation; any unexpected user stops execution.
- Read-only configuration comparison confirms localhost Site URL and exact
  `/auth/confirm` redirect, global/anonymous signup disabled, email provider and
  confirmation enabled, minimum password length 12, SMTP enabled, TOTP
  enrollment/verification enabled and capacity 10. Saved fragment link was
  explicitly confirmed by the owner in Stage 2E.8, not independently retrieved
  as HTML. No setting is changed.
- The dedicated private environment remains intact. Readiness RPC passed with
  recovery disabled. The loopback launcher emitted `auth_preflight ready`.
  `/auth/confirm` and `/auth/set-password` return 200 with no-store/no-referrer.
- The detached launch command was blocked by the execution environment; no
  process was started by that command. The reviewed launcher was instead
  started directly in a managed terminal session and verified listening only
  on 127.0.0.1:3000. No existing listener was terminated.
- An initial cold-start page check did not complete before the server was fully
  ready; its generic wrapper did not establish a precise failure category.
  A bounded follow-up after the ready label verified both pages and headers.
  No invitation or Auth mutation was attempted during that startup check.

## One-request invitation safeguards

The private helper has a fixed project/mailbox, validates the protected test
configuration and fresh catalog/app evidence, and refuses any prior attempt
marker. Its transport permits only the read-only Admin user list and exactly
one `/auth/v1/invite` POST with that email and fixed localhost redirect. An
exclusive marker is written before the POST. Redirect following, automatic
resends, role binding and other API operations are prohibited. Raw API responses,
tokens and credential values are never saved or printed. SDK-returned UUID/email
and acceptance status are recorded privately. A failed/uncertain request stops;
do not rerun it or create another identity.

The application consumes email tokens only after explicit Continue POST,
uses fragment cleanup and fixed token-free request URLs, signed single-use
durable tickets, strict Origin validation and checked sign-out. The launcher
filters output to fixed diagnostic labels; view them with
`npm run auth:hosted:logs`. Never export HARs or log request/response bodies.
Framework and browser-extension logging remains a residual operational risk;
no claim of universal infrastructure log elimination is made.

## Mandatory password-setup stop

After Supabase accepts the one invitation, stop all automatic testing and ask
the user to open the new email, follow its localhost link, click Continue once
and set a unique password of at least 12 characters. The expected unassigned
success message is **“Password saved. Your account is pending activation.”**
The user reports only success or a generic failure, never a password, URL,
token, cookie or session value. Supabase acceptance is not proof of delivery.

Only after the user's reply, perform the next approved read-only verification:
compare the exact stored UUID/email, confirmation and database-side password-
presence boolean, no profile/assignment and intended sign-out/session state.
Do not retrieve password hashes or replay the invitation. MFA steps remain
pending until this checkpoint passes and the user is ready.

## Next approved manual MFA checkpoint, not executed yet

Guide sign-in and `/auth/mfa` only after password setup is verified. The user
privately unlocks KeePassXC, finds **BE WISE — MFA Test**, right-clicks it,
chooses **TOTP → Set up TOTP**, enters the site's manual setup key, saves the
encrypted database, and enters the current six-digit code into the website.
Never request that key/code in chat or capture it from logs. Stop again for
user interaction. Verify factor status, session AAL2 and continued lack of staff
membership from real evidence, not the existence of an enrollment alone.

Future approved checks include invalid-code rejection, a fresh password-only
AAL1 session, another valid challenge, and checked sign-out/cookie cleanup.
Use no more than the available three per-email sign-ins per fixed hour; do not
reset shared quotas to continue. Permission-positive staff tests need a separate
role-binding approval and are excluded here. No dashboard exists to test as an
implemented feature; authorization guards and the existing MFA staffAccess
indicator are the available boundaries.

Account deletion, factor removal, audit deletion, backup-factor enrollment,
founder onboarding, recovery enablement and hosted schema/settings changes
remain prohibited. Keep the account present until exact cleanup is separately
authorized. See [Stage 2E.7 test matrix](./hosted-mfa-integration-readiness.md)
and [TOTP configuration verification](./hosted-totp-configuration-verification.md).
