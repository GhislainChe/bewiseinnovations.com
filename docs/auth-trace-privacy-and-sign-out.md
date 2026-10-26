# Stage 2D.23 — confirmation privacy and checked sign-out

Reviewed 26 October 2026. No hosted settings, accounts, records or credentials
were changed. Existing development traces were preserved.

## Why the development trace contained tokens

The previous email links put `token_hash` in the query string. Next.js can record
the incoming request URL before a route, proxy or sanitized console filter runs.
Suppressing application request logs did not sanitize `.next/dev/trace`.
No-store and no-referrer protect different boundaries; neither removes an
incoming URL from a framework trace. Previously captured traces remain sensitive
even though the tested invitation has been consumed.

New links put the token in a URL **fragment**. A fragment is excluded from the
HTTP target ([HTTP semantics](https://httpwg.org/specs/rfc9110.html#target.resource)).
The confirmation GET therefore requests `/auth/confirm` without the token.
A static, early `beforeInteractive` script in the root layout removes the
fragment with `history.replaceState`, then hands it once to the client component
through a memory-only closure. It uses neither localStorage nor sessionStorage.
The component validates only `invite` and `recovery`, keeps the token in browser
memory/its form, and submits it only after Continue. Page departure clears the
memory handoff. Reloading the cleaned URL requires reopening the email link.
JavaScript is required; there is no native-form fallback that consumes on GET.

The server-rendered landing shell contains no token. The POST still uses the
existing explicit CORS-mode fetch, strict trusted Origin checks, no-referrer,
no-store, verified Supabase identity and atomic one-time flow ticket. Redirects
accept only fixed authentication paths and known message parameters, never
token-bearing query strings or fragments. Application diagnostics remain fixed
allowlisted labels, with no request bodies or raw provider errors.

Legacy query-token links fail closed and are removed from the visible URL. This
cannot undo framework/proxy logging of their initial request. Do not use old
query-format emails for subsequent testing.

## Required manual template update before another invitation

This code change does **not** update hosted templates. After separate approval,
in the correct project open Authentication → Email → Templates → Invite user and
Reset password. Preserve the surrounding reviewed HTML and change their links:

```html
<!-- Invite user -->
<a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=invite">Accept invitation</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=recovery">Reset password</a>
```

Keep Site URL `http://localhost:3000` and the exact redirect allowlist entry
`http://localhost:3000/auth/confirm`. The local recovery template uses
`{{ .RedirectTo }}` with the existing fixed confirmation redirect and the same
fragment. Do not enable hosted recovery or send another email as part of this
documentation change. Email-link rewriting/tracking must be disabled or reviewed
to ensure it does not move the fragment into a provider's logged query string.

## Residual risks and trace handling

This prevents the tested fragment from reaching request URLs. It is **not** a
claim that arbitrary framework/server logging is completely sanitized. Old
query-format links can still be captured before application code. Browsers,
extensions, history synchronization, email systems or link-rewriting services
can see the original email link before the early script runs. Tokens necessarily
reach the confirmation POST body and Supabase verification service. Do not enable
body logging, browser session recording, analytics or third-party scripts on
authentication routes. Production requires HTTPS and a reviewed CSP that permits
the early script without admitting untrusted scripts. Do not publish `.next`,
private browser profiles, raw diagnostics, HAR files or trace bundles.

`.next/`, `.supabase/` and environment files remain Git-ignored. The local
`.supabase/auth-trace-assessments/` manifest records only artifact names, sizes,
SHA-256 file hashes and occurrence counts, never captured tokens. This assesses
the diagnostic value without copying token content; a running development
server can subsequently append to those files. Sanitized diagnostic labels and
the existing incident reports are sufficient for the documented root cause.

Safe cleanup, **not executed in this stage**:

1. Obtain separate approval and stop only the identified development server so
   artifacts stop changing. Do not terminate unrelated Node/Docker processes.
2. Reassess the exact `.next/dev/trace` and `.next/dev/logs/next-development.log`
   files privately. Preserve only sanitized labels and metadata needed for the
   incident; do not upload raw traces for support or commit them.
3. Resolve and check each absolute target remains within this workspace's
   `.next/dev` directory. Delete only the approved trace/log artifacts with
   PowerShell `Remove-Item -LiteralPath`; preserve database backups, environment
   files and unrelated diagnostic data.
4. Review copies in synced folders, trash, backups and external tools under the
   owner's retention policy. File deletion does not guarantee physical erasure
   on SSDs or removal of remote copies. Recheck ignore rules before committing.

## Sign-out behavior

Every application Supabase sign-out call now passes through a checked helper.
It checks returned errors and catches thrown failures without logging provider
details or automatically retrying. Scope remains `local`: the current session.
After password update, the flow cookie is expired at its original host-only
`/auth` path. The database ticket remains redeemed even if the update or logout
fails; it is never restored to allow replay.

Pending activation/password success is shown only when both password update and
sign-out succeed. An uncertain sign-out instead says it could not be confirmed
and the password may have been saved. The error page offers an explicit retry at
`/auth/sign-out`; its POST is Origin-protected and signs out only the caller.
GET does not sign out, redirect repeatedly, redeem tickets or mutate accounts.
Unassigned users can end their own sessions without gaining staff privileges.
On failure the application does not claim that server-side revocation occurred
or deliberately discard the Auth credentials needed to retry. The flow cookie
is cleared, and account recovery/admin assistance remains the fallback.

Checked sign-out cannot guarantee immediate invalidation of every already-issued
access JWT; expiry and server-side staff authorization continue to apply. No
hosted session operation was performed to test failure behavior in this stage.

## Verification and remaining gates

Run the browser checks sequentially against the corrected localhost server:

```powershell
npm run test:auth
npm run test:auth:http
npm run test:auth:fragment
npx supabase test db --local
npm run typecheck
npm run lint
npm run build
```

The fragment test uses synthetic markers only. It checks a real headless Edge
browser, memory-only handoff, cleaned address bar, no token in fixture HTTP URLs,
the actual Next.js landing page, no confirmation POST on GET, and absence of its
marker in the inspected development trace/log. It never consumes an invitation.
Mocked tests cover successful and failed logout, session state, spent-ticket
replay, cookie cleanup and rejection of token-bearing redirects. Database tests
exercise real local RLS/authorization; mocked logout tests are not hosted
integration evidence. Browser tests share diagnostics and must not run together.

Stage results: 66/66 authentication tests and 74/74 local PostgreSQL assertions
passed; the real HTTP regression and real Edge fragment checks passed when run
sequentially. TypeScript, ESLint and production build passed. The optimized
browser JavaScript scan found no references to either server-secret environment
variable name. This is a boundary check, not a general proof against every kind
of secret disclosure. Full Auth/Mailpit end-to-end tests were not rerun; the
local harness and templates were adjusted for fragments without sending email
or creating users in this stage. One parallel browser-check run conflicted with
the other check's intentional dummy POSTs; the sequential rerun passed.

Implementation files for this stage:

- Confirmation: `src/lib/auth/fragment.ts`, `confirmation-input.ts`,
  `src/components/auth/confirmation-landing.tsx`, `src/app/auth/confirm/page.tsx`
  and root `src/app/layout.tsx`.
- Checked logout: `src/lib/auth/sign-out.ts`, `password-operation.ts`,
  `password-response.ts`, `password-handler.ts`, `supabase-gateway.ts`, the new
  `src/app/auth/sign-out/` page/POST route and the existing auth error page.
- Shared form/redirect allowlists: `src/components/auth/auth-form.tsx`,
  `src/lib/auth/form-submit.ts` and `http.ts`.
- Tests: fragment/sign-out/confirmation page/password operation/form-submit/HTTP
  tests, `scripts/test-auth-fragment-browser.ts`, and its package script.
- Local-only templates/harness: `supabase/templates/invite.html`,
  `recovery.html`, and `scripts/test-local-auth-integration.mjs`.
- Documentation: this guide, `auth-flows.md` and
  `hosted-auth-configuration.md`. Existing unrelated working changes were kept.

Before temporary-account cleanup, obtain separate deletion/associated-record
cleanup approval and finish any required private evidence review. Before founder
invitations, manually update/review the fragment email templates after approval,
verify link handling in the actual email client/browser with separately approved
testing, and complete MFA, recovery and production deployment security gates.
Hosted recovery remains disabled. No invitation, account cleanup or hosted
configuration change is authorized by this stage.
