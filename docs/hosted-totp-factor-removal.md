# Stage 2E.11 — controlled hosted factor removal and session cleanup

## Replacement enrollment — user checkpoint verified read-only

After fresh private login the user reported AAL1 and no enrolled factor, then
manually completed one replacement enrollment/verification using a new KeePassXC
entry. They reported AAL2, one verified factor, pending activation, no sign-out
and no backup enrollment. The agent did not enroll or challenge a factor.

Read-only inspection subsequently confirmed the same original confirmed Auth
UUID/email, exactly one verified TOTP factor with a **different ID**, created
after the completed global session cleanup. The retired factor remains absent.
Exactly one session is recorded at AAL2 and tied to the replacement factor.
There are still zero profiles and assignments, one total Auth identity, and
unchanged migration/catalog digests and 4/18/31 counts. Opaque factor/session
references are pinned in the private replacement-factor-verification record.
No setup secret, password/hash, access token or refresh token was retrieved.

This corroborates the user-performed replacement and its session linkage. It
does not independently prove seed secrecy or supply an independent-device or
backup-factor pass. Historical screenshot attribution remains unresolved, but
the pinned old factor is no longer enrolled. No role or membership was granted.
Secure browser-session harness wiring and explicit permission-test approval
remain separate requirements. No additional sign-out, revocation or mutation
was performed during this verification. Stop pending the user's next stage.

## Final server-side cleanup checkpoint — verified

After the user privately signed in and reported AAL1, read-only checks confirmed
two AAL1 sessions, zero factors and unchanged zero staff membership. The user
clicked the one-use private helper once and reported its accepted result. The
private record independently confirms `revocation_accepted` and exactly one
global logout call for the same original disposable UUID.

Subsequent read-only reconciliation found **zero sessions, zero refresh-token
records (zero unrevoked), zero factors, zero profiles and zero assignments**.
Both exact session IDs captured before logout are absent. The same confirmed
Auth identity remains; no other Auth identities exist. Migration and
role-permission catalog digests remain unchanged. No additional logout, factor
operation or account/role mutation was performed during verification.

This confirms accepted provider global logout and removal of server-side
session/refresh state; no token replay was performed and no claim of instant
cryptographic invalidation of old access JWTs is made. Browser cookie state
has not been independently reported at this final checkpoint. The one-use
helper was stopped; the normal loopback app remains available with diagnostics
off and recovery disabled. The next manual checkpoint is a fresh private login,
observe AAL1/no factor, and stop before replacement enrollment. New factor
enrollment/challenge has not been performed by the agent.

The following sections preserve the intermediate observations and resolved
blocker; their statements about remaining sessions describe earlier checkpoints.

Target: **onfxxtvfprjnqsxdmhkp**, the previously recorded disposable identity
for **hndstudy2026@gmail.com**. The original UUID is preserved privately.

## Authorized operation and checks

The user explicitly authorized removal of this one potentially exposed TOTP
factor, reconciliation/invalidation of this identity's affected sessions and
read-only verification. No profile/role, other identity, settings, schema,
password, invitation or re-enrollment action was authorized or performed.

Final preflight matched the CLI link and session-pooler identity, the original
private UUID and independently retrieved Admin Auth UUID/email/confirmation.
Exactly one pinned verified TOTP factor matched the prior private record. There
were no staff profiles/assignments and no other Auth identities. One affected
session and two refresh-token records (one unrevoked) were counted. Only opaque
session/factor identifiers and safe metadata were retained privately; no seed,
password/hash, cookie or access/refresh token was retrieved or logged.

The one-shot private administrative runner used the existing protected hosted
environment and supported `auth.admin.mfa.deleteFactor({userId,id})`. It allowed
only the exact user GET and one exact factor DELETE on the expected Auth origin.
An exclusive attempt marker prevents a repeat. HTTP calls had bounded timeouts;
all database inspection enforced read-only transactions. The initial private
runner had a local parse error corrected before preflight or any API mutation.

## Actual result

**Factor removal PASSED:** exactly one DELETE was sent; Supabase returned HTTP
200 without a reported SDK error. Read-only inspection and an independent Admin
identity lookup then confirmed:

- Same confirmed UUID/email; identity was not deleted.
- Original factor absent; zero remaining factors and no unexpected enrollment.
- Zero profiles and assignments; no effective staff role was granted.
- Four migration records/digest unchanged; role-permission catalog digest and
  counts unchanged at **4 roles / 18 permissions / 31 mappings**.
- Zero unrelated Auth identities existed before or afterward.

**Session revocation NOT COMPLETE:** the same previously recorded session still
exists, now **aal1** with a NULL factor reference. Before removal it was aal2 and
referenced the retired factor. Two refresh-token records remain, one marked
unrevoked. No additional revocation was attempted. The runner reported the
incomplete postcondition instead of declaring the stage passed.

The JavaScript [Admin deleteFactor reference](https://supabase.com/docs/reference/javascript/auth-admin-deletefactor)
describes logging out active sessions for a verified factor. However, the
[current Supabase Auth server implementation](https://github.com/supabase/auth/blob/master/internal/api/admin.go)
deletes the factor and calls DowngradeSessionsToAAL1. That source behavior is
consistent with the observed downgrade; the exact deployed server commit was
not independently established. Do not generalize the documentation's logout
claim or pretend the remaining session was revoked.

The existing database MFA guard requires a live AAL2 session tied to a currently
verified TOTP factor. This session's downgrade and removed factor cannot satisfy
that requirement, and the account remains unassigned. This is not proof that
all Auth access or old tokens are invalid. No token replay or browser
reauthentication was performed, and JWTs can retain cryptographic validity until
expiry. No remaining refresh-token value was fetched to test it.

## Blocking prerequisite and next checkpoint

The user subsequently confirmed that no account-specific Dashboard session
revocation action is visible. No additional administrative mutation was made.
A protected, Git-ignored one-use localhost helper was prepared instead, with
16 mocked identity/scope/failure/HTTP-guard checks passing. It binds only to
127.0.0.1:3011 and accepts the exact localhost Host/Origin, an in-memory random
CSRF nonce and an explicit button POST. GET never authenticates or signs out.
It uses the normal publishable-key SSR client with the caller's browser cookies
in memory, verifies the exact original disposable UUID through existing Auth
verification and calls signOut with scope global once. It does not use a
service-role client, ask for a token, persist session credentials, create a
public endpoint, or support another identity. Its private exclusive attempt
marker and fixed result labels prevent automatic mutation retries.

The existing Next hosted-test launcher was started on 127.0.0.1:3000 with cookie
diagnostics explicitly off and recovery disabled; private dotenv files remain
unchanged. The helper's preparation does not itself perform Auth sign-in or
revocation. The next manual checkpoint is one private password sign-in through
the existing /auth/sign-in page, **no enrollment**, then report AAL1. Recheck
session metadata before directing the user to the helper's one global-sign-out
button. Global here means all sessions of this verified disposable subject,
not all users. Read-only reconciliation must then verify the old and new test
sessions/refresh-token state; stop both identified local processes afterward.
Re-enrollment remains blocked until that reconciliation passes. The helper
expires after 30 minutes; an expired helper must be reviewed before restarting,
and no marker may be removed to bypass a recorded attempt.

The documented [Admin signOut method](https://supabase.com/docs/reference/javascript/auth-admin-signout)
and installed SDK require an actual valid logged-in **user JWT**. An admin key
or user UUID is not a replacement. No such disposable-user credential is held
by the runner. Do not fabricate a JWT, generate recovery links, read stored
refresh-token values, reset a password, ban/delete the identity, or directly
delete managed Auth session rows as a workaround.

The user has been asked whether the Dashboard's exact-account details offer
an account-scoped supported sign-out/revoke-sessions action. They should report
only its availability/label before any click; do not assume such a UI exists.
If unavailable, prepare a reviewed localhost-only user-authenticated global
sign-out workflow with secrets kept in server/browser memory. That requires a
manual private login checkpoint; no token may be pasted into chat, a command
argument or a file. Existing application sign-out is local-scope and would not
by itself guarantee removal of this older session from a new login.

Session revocation remains within the user's existing exact-account approval;
the missing item is a supported secure authentication channel, not permission
to repeat factor deletion. Stop on any ambiguous revocation result and inspect
read-only. Once the old sessions and refresh-token state are reconciled, update
this report before proceeding to replacement enrollment.

**Do not enroll a replacement factor yet.** After session cleanup passes, the
manual sequence is: launch the reviewed localhost hosted-test app with diagnostic
override absent; sign in privately with the existing password; observe AAL1;
open `/auth/mfa`; start one replacement TOTP enrollment; create a NEW encrypted
KeePassXC entry and enter the new setup key privately; verify with a current
code; report only AAL2 and verified-factor/pending-activation status. Do not
share a QR/setup key, password, code, cookie or token. This Windows/KeePassXC
test is not independent-device or backup-factor proof. No automatic enrollment
or MFA challenge was performed.

## Evidence and files

The protected, Git-ignored `.supabase/hosted-mfa-stage-2e9/` directory contains
the pinned preflight/before/after snapshots, one-attempt marker, safe HTTP result
and reconciliation report with the `factor-removal-` prefix. Preserve them to
avoid accidental re-execution. No secret is included in those metadata reports.
No application code, migration, private environment file or Auth setting changed.
The local development server was not started and diagnostics were not enabled.
No app tests were rerun: this was an administrative operation and read-only
reconciliation, not an application code change.
