# Stage 2D.25 — controlled authentication test cleanup

Completed 26 October 2026 for Supabase project `onfxxtvfprjnqsxdmhkp` under
the owner's explicit authorization for one trace file and one disposable Auth
identity with its redeemed flow ticket. No other deletion was performed.

## Target checks before deletion

The linked project reference and session-pooler connection identity matched the
approved project. A bounded read-only PostgreSQL check reread the account UUID
and compared it with the [Stage 2D.24 record](./auth-privacy-cleanup-readiness.md).
The server-only Admin API additionally reread the same UUID/email immediately
before issuing the one authorized deletion request.

| Pre-deletion check | Verified result |
| --- | --- |
| Disposable email | `hndstudy2026@gmail.com`; exactly one match |
| UUID | `f9df9fb7-7eae-40ff-abed-b497189ad46e`; unchanged |
| Auth state | Confirmed, ordinary authenticated account |
| Staff profiles / role assignments | 0 / 0 |
| Sessions / unrevoked refresh tokens | 0 / 0 |
| Tickets owned by exact UUID | 1 invitation ticket, redeemed |
| Usable tickets | 0 |
| Owned Storage objects / public audit references | 0 / 0 |

No token, password hash, cookie or credential value was retrieved or printed.
Password presence was evaluated as a database-side boolean only.

## Local trace cleanup

The localhost listener was the verified Next.js worker PID 32016, whose command
referenced this checkout. Its parent PID 34820 was the loopback-only Next dev
CLI, launched by this checkout's secure hosted-test launcher. Only the identified
worker was stopped. Port 3000 was then verified to have no listener. No unrelated
Node, browser or Docker service was stopped.

A stopped-server assessment scanned 416 generated files with no changes during
the scan. Only `.next/dev/trace` matched the historical sensitive token-query
pattern: 276 occurrences in a 1,409,422-byte file. These are occurrence counts,
not distinct-token counts.

Before deleting, the absolute workspace and file path were checked, reparse
points were rejected, and size/SHA-256 matched the fresh assessment. PowerShell
`Remove-Item -LiteralPath` removed only the approved file. No recursive or
wildcard deletion was used.

Preserved private assessment:
`.supabase/auth-trace-assessments/stage-2d24-2026-10-26T02-46-09-655Z.json`.
The filename comes from the existing assessment command; this fresh assessment
was taken during Stage 2D.25. It contains **173 fixed allowlisted diagnostic
events**, elapsed timestamps, integrity metadata and counts, not raw token values.
The development console log, other traces, source, environment files, browser
profiles, database backups and earlier assessments remain present.

The historical `.next/dev/trace` is absent. The development server was left
stopped and was not restarted in this stage. A later Next dev process can create
a **new** trace; the prior assessment found no other generated file containing
the tested historical token-query pattern to restore from. Stage 2D.24's real
Edge tests established that the current fragment invite/recovery flow does not
send its synthetic token in HTTP request URLs or retain it in inspected traces.
This is not a guarantee against future requests using old query-format links:
do not reopen those emails or enable body/URL telemetry. No real token was
replayed to test cleanup.

## Hosted identity and ticket cleanup

The private server-side Supabase Admin client sent exactly one hard-delete
request for the verified UUID. The client restricted network access to that
project and exact user's Admin API path, disabled persisted sessions, imposed
timeouts, and performed no automatic retries. A private attempt marker prevents
accidental rerunning of the one-off helper. Supabase accepted the deletion.

The existing `auth_flow_tickets.user_id` ON DELETE CASCADE foreign key removed
the exact user's single redeemed ticket. No separate ticket DELETE, role change,
schema change or direct mutation of managed Auth SQL tables was needed.

The subsequent read-only inspection at **03:48:19 Africa/Douala (UTC+01:00)**
verified:

| Post-deletion check | Result |
| --- | --- |
| Exact UUID / disposable email | Absent / no matches |
| Profiles / assignments for UUID | 0 / 0 |
| Sessions / unrevoked refresh tokens / confirmation OTPs | 0 / 0 / 0 |
| Tickets for UUID | 0 |
| RBAC tables with RLS | All 6 intact |
| Auth security tables with RLS | Both intact |
| Roles / permissions / mappings | 4 / 18 / 31 |
| Role, permission and mapping content digests | Unchanged |
| Unrelated Auth identity digest | Unchanged |
| Unrelated tickets, recovery buckets, profiles and public audit records | Unchanged |

There were no other hosted Auth users before deletion and none afterward. No
founder accounts were created or deleted, no role was assigned, and no email was
sent. Hosted Auth settings and migrations were not changed. No partial cleanup
or uncertain deletion outcome remains.

## Validation and files

- Authentication unit/mocked/rendering tests: **66/66 passed**.
- PostgreSQL security assertions against local Supabase only: **74/74 passed**.
- TypeScript and ESLint: passed.
- Production build: passed.
- Final local checks: historical trace absent; no port 3000 listener; sanitized
  assessment, development log and source preserved.

Application source, dependencies and SQL migrations were not changed in this
stage. Documentation added this report and linked it from the current guides.
The only deleted local file was `.next/dev/trace`. Private Git-ignored one-off
helpers, before/after count/digest snapshots, attempt/result receipts and the
verification summary remain under `.supabase/`; none contains a copied
credential. Existing environment files were untouched.

## Remaining security boundaries

Deletion does not erase independent mailbox, browser history/sync, backup or
external diagnostic copies, nor guarantee physical erasure on an SSD. Those
were outside the authorization and were not deleted. The application still
cannot retroactively prevent logging of an incoming legacy query-token URL.

The development server is intentionally off. Use only the secure hosted-test
launcher for later approved testing and keep recovery disabled unless separately
approved and configured. Real hosted delivery of the newly saved fragment
templates, production HTTPS/CSP, MFA and account recovery readiness remain
separate gates. Founder provisioning or another invitation needs new explicit
authorization; cleanup grants no such authorization.
