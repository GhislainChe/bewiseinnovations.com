# Stage 2D.24 — privacy cleanup and readiness

Historical preparation record. The owner subsequently approved the exact cleanup
in Stage 2D.25; see [completed cleanup results](./auth-test-cleanup-result.md).
The original verification and proposal below are preserved for audit context.

Reviewed 26 October 2026 for `onfxxtvfprjnqsxdmhkp`. This stage performed
read-only hosted inspection, synthetic local browser/HTTP checks and local
database tests. Nothing was deleted. No emails, account mutations, role grants,
hosted settings changes, migration deployments or website deployments occurred.

## Fragment confirmation and template readiness

The [Stage 2D.23 design](./auth-trace-privacy-and-sign-out.md) remains intact:

- The static root-layout script captures the fragment, removes it using
  `history.replaceState`, and makes one memory-only handoff to the confirmation
  component. Unsupported query links fail closed. No localStorage or
  sessionStorage is used for confirmation tokens.
- The server GET renders a token-free shell. The browser renders the validated
  invite/recovery form after hydration. Only explicit Continue submits the
  token in the POST body; strict Origin checks, duplicate-submission protection,
  no automatic retries, no-referrer/no-store and atomic ticket redemption remain.
- The application fetches a fixed `/auth/confirm/complete` URL. Supabase
  `verifyOtp` receives the token in its request body. Application-controlled
  confirmation/redirect URLs do not append the token. Redirect guards reject
  fragments and unexpected query parameters.

The owner explicitly reconfirmed **all exact saved Dashboard values** during
this stage. This is owner-verified, not an independent retrieval of hosted
template HTML. No supported saved-template read was performed with the current
CLI/readiness credentials. These settings are compatible with the implementation:

```text
Site URL: http://localhost:3000
Redirect allowlist: http://localhost:3000/auth/confirm
Invite: {{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=invite
Recovery: {{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&type=recovery
```

Inside HTML attributes `&amp;` is equivalent. Hosted recovery remains disabled
in the private test launcher. Compatibility is not a new real-email delivery or
hosted recovery test: neither was executed.

## Current trace inventory and preserved diagnostics

The new local-only `scripts/assess-auth-traces.ts` can be rerun with:

```powershell
npx tsx scripts/assess-auth-traces.ts
```

It scans generated files within `.next/dev`, checks that artifacts/output are
Git-ignored, rejects symlinks, and writes only file metadata plus fixed allowlisted
diagnostic labels. It loads no credentials and never deletes anything. It detects
the historical 56-hex token query shape, including percent/JSON-escaped
assignments; this is not a proof of absence of every secret or encoding.

Assessment manifest:
`.supabase/auth-trace-assessments/stage-2d24-2026-10-26T02-08-36-506Z.json`.
It preserves **173 sanitized diagnostic events**, their elapsed timestamps, and
file SHA-256 metadata, with no token values or raw log contents copied.

| Scope/findings at assessment | Result |
| --- | --- |
| Generated files scanned | 412 |
| Bytes scanned | 167,343,584 |
| Files changed during scan | None |
| File containing historical token-query matches | `.next/dev/trace` |
| Trace size at assessment | 1,400,149 bytes |
| Token-query occurrences | 276; not 276 distinct tokens |
| Other scanned files with that pattern | None |
| Files deleted | 0 |

The actual request-bearing trace is sensitive. The filtered development log
`.next/dev/logs/next-development.log` had no matches for that historical token
pattern; its relevant safe events are preserved. It is **not** included in the
proposed deletion, nor are other generated traces, source files, environment
files, private browser profiles or database backups. The running server can
append after assessment; rerun the inventory after stopping it before deletion.

### Separately approved trace cleanup procedure — not executed

1. Obtain explicit approval to stop only this checkout's localhost hosted-test
   development process and delete **only `.next/dev/trace`**. Re-identify the
   listening process immediately beforehand; do not terminate unrelated Node,
   browser or Docker processes. The listener observed this stage was PID 32016
   on `127.0.0.1:3000`; that PID must not be trusted later without rechecking.
2. Stop the approved process through its launcher/terminal. Rerun the assessment
   and retain the sanitized manifest/events. If additional sensitive files are
   discovered, stop and obtain approval for those additional exact paths.
3. Verify the working directory is this checkout. Resolve the absolute trace
   path, confirm it is exactly this workspace's `.next/dev/trace`, that no path
   component is a symlink/reparse point, and it is a regular generated file.
   Compare its stopped-file SHA-256 with the fresh assessment. A changed or
   unexpected path/hash requires another review.
4. Only then use PowerShell `Remove-Item -LiteralPath` on that single verified
   absolute file. Do not use wildcards, recursion, a directory-wide cleanup,
   `git clean`, or delete the whole `.next` tree. Verify the approved file is
   absent while preserved diagnostics and all unrelated artifacts remain.
5. Restart only if approved, using `npm run auth:hosted:dev`. A new framework
   trace can be generated. Do not reopen legacy query-token emails. Use only
   synthetic fragment checks to assess new traces unless another live test is
   separately authorized.

Local deletion cannot retract copies in email, browser history/sync, shared
diagnostic uploads, backups or remote systems, and is not guaranteed physical
erasure on SSDs. Review those systems under the owner's retention policy;
do not silently delete backups or mailbox messages.

## Disposable hosted account review and cleanup proposal

A bounded PostgreSQL 17 client inspection used the linked project's session
pooler, verified project-scoped connection identity, and a read-only transaction.
Observed at **2026-10-26 02:07:06 UTC**:

| Check | Current result |
| --- | --- |
| Exact disposable account | `hndstudy2026@gmail.com` |
| Original UUID | `f9df9fb7-7eae-40ff-abed-b497189ad46e`; unchanged |
| Email match count / confirmed | 1 / yes |
| Password credential configured | Yes; database-side boolean only |
| Auth role / super-admin | Ordinary authenticated / false |
| Team profile / role assignments | 0 / 0 |
| Auth sessions / unrevoked refresh tokens | 0 / 0 |
| Invitation token cleared / confirmation OTP rows | Yes / 0 |
| Flow tickets / redeemed / usable | 1 / 1 / 0 |
| Owned Storage objects / audit actor records | 0 / 0 |

No hash, token, cookie or password value was retrieved or printed. No OTP or
ticket redemption was attempted. Current session state is consistent with
successful prior sign-out; it does not newly inspect the owner's browser.
The owner previously reported both Auth and flow cookies absent in Stage 2D.22.

### Separately approved account cleanup — not executed

1. Obtain approval for permanent deletion of **this exact UUID and its associated
   disposable Auth data and one redeemed flow ticket**, in this project only.
   Keep this independent from local trace deletion approval.
2. Recheck linked/API project, UUID-email equality, uniqueness, absence of profile,
   role assignments, active sessions, usable tickets, Storage ownership, audit
   references and new dependencies. Any unexpected data or changed identity is
   a stopping condition. Never select by email alone for deletion.
3. Use the secure server-only Supabase Admin API `deleteUser` for this UUID
   (hard deletion, not soft deletion), or its reviewed Dashboard equivalent.
   Do not expose a web deletion endpoint or issue direct SQL against Auth tables.
   Check the result explicitly. If uncertain or disconnected, inspect state
   read-only before any retry; do not blindly repeat the operation.
4. The inspected application foreign keys referencing `auth.users` are
   `team_profiles.id` and `auth_flow_tickets.user_id`, both ON DELETE CASCADE.
   There is no profile to cascade today. The single redeemed ticket should
   cascade. Auth-owned identity/session cleanup is handled by the Auth service.
   Verify these expectations after deletion rather than assuming success.
5. Read-only verification must show the exact UUID/email absent, its tickets,
   profiles, assignments and sessions absent, and all role/permission definitions
   and unrelated accounts intact. Preserve existing audit records if any appear;
   stop for review rather than silently deleting them. Shared recovery buckets
   have no user FK and must not be wiped as part of this account cleanup.

Supabase's [Admin deleteUser API](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser)
requires trusted server credentials. Its
[user management guidance](https://supabase.com/docs/guides/auth/managing-user-data)
also warns that Storage ownership can block deletion and existing access JWTs
can remain valid until expiry. Current counts remove those observed data
blockers, but deletion still needs approval and a fresh check. Backups/mailbox
copies have independent retention; account deletion does not remove them.

## Sign-out and persistence review

All application Supabase logout calls use the checked helper. Returned errors
and thrown failures do not produce success/pending-activation messages. The
flow cookie is expired with its original host-only `/auth` attributes; a failed
logout offers a user-initiated Origin-protected retry. A spent ticket remains
spent on failure. The app does not pretend remote revocation succeeded.
Existing Auth session cookies remain part of the SSR design; the confirmation
token itself is not placed in persistent browser storage. Mocked logout failure
tests were rerun; no live hosted logout/session mutation was invoked.

## Validation and remaining security boundaries

- Authentication unit/mocked/rendering tests: **66/66 passed**.
- Real local PostgreSQL pgTAP assertions: **74/74 passed**.
- Real browser/HTTP regression: passed; fixed Origin transport, one POST for
  duplicate submissions, stable error page, dummy rejection before OTP calls.
- Real Edge fragment checks: invite and recovery landing pages, memory handoff,
  URL cleanup, no automatic POST, no synthetic marker in inspected framework
  trace/logs. No real tokens or emails were used.
- TypeScript, ESLint and production build: passed.

The new fragment format has not been retested through real hosted email delivery.
Browser extensions, email tracking/link rewriting, pre-JavaScript history,
external logs and previously retained copies remain outside the application's
complete control. Do not enable body logging, analytics/session recording or
third-party assets on sensitive pages. HTTPS/CSP, MFA enrollment/enforcement,
approved recovery configuration and operational recovery readiness remain
production/founder-provisioning gates. No new founder invitation is authorized.

Files added/updated in this stage: this report, links in the two authentication
guides, `scripts/assess-auth-traces.ts`, and invite/recovery coverage in
`scripts/test-auth-fragment-browser.ts`. Private ignored artifacts contain only
the sanitized assessment and a read-only account-review helper. Existing work
and all trace artifacts were preserved.
