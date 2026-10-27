# Stage 2E.8 — hosted TOTP configuration verification

Reviewed **26 October 2026**. Project: **onfxxtvfprjnqsxdmhkp**.
Hosted operations were read-only. No account, email, factor, challenge, staff
record, role, credential, setting or migration was created or changed. No app
server or deployment was started. Production recovery remains disabled.

## Confirmed configuration

The exact linked reference and explicit CLI target matched. The supported
read-only configuration comparison returned all six configuration scopes with
none missing. Required fields were explicitly declared locally, supported by
the comparison, and neither masked nor unmanaged; unchanged fields therefore
match the current hosted values. SMTP enabled was an explicit remote difference.

| Hosted setting | Confirmed value |
| --- | --- |
| TOTP enrollment | Enabled |
| TOTP verification/challenges | Enabled |
| Maximum enrolled factors | 10; sufficient for the planned two factors |
| Site URL | `http://localhost:3000` |
| Additional redirect allowlist | Exactly `http://localhost:3000/auth/confirm` |
| Global public signup | Disabled |
| Anonymous sign-in | Disabled |
| Email/password provider | Enabled |
| Email confirmation | Required |
| Minimum password length | 12 |
| Custom SMTP | Enabled; this is not a new delivery test |

The local application also caps enrollment at five factors, which allows the
planned primary and backup. Supabase documents that disabling verification also
disables challenges; the current enabled verification flag permits both.
See [Supabase MFA configuration](https://supabase.com/docs/guides/auth/auth-mfa).
**No actual hosted enrollment or challenge was attempted:** that requires an
approved Auth identity and changes Auth records. Settings readiness is not an
end-to-end or physical-device pass.

Methods, each bounded to at most 45 seconds:

```powershell
npx supabase config pull --dry-run --project-ref onfxxtvfprjnqsxdmhkp
npx supabase config diff --project-ref onfxxtvfprjnqsxdmhkp --output-format json
node scripts/verify-hosted-auth-api.mjs
npm run auth:hosted:check
```

Only the pull **preview** was used; no pull write or config push occurred.
The preview's machine-readable output did not match the initial TOML-section
parser, which yielded no observations; that result was not treated as a pass.
The structured diff was then interpreted by explicit field paths, scope,
masked/unmanaged checks and known local declarations. Raw configuration and
CLI credential handling stayed in memory; no SMTP/password/token values were
printed or saved. Local config and all three existing private environment files
were checked unchanged around the preview.

The live public Auth settings independently returned **HTTP 200**,
`external.email=true`, `disable_signup=true`, `mailer_autoconfirm=false`, and
allowed Origin `http://localhost:3000`. Anonymous execution of the read-only
Auth-store readiness RPC was correctly denied with **401 / 42501**. The separate
privileged server-only readiness command passed with recovery still disabled,
same-project configuration, signing-secret format and file privacy checks.
No ticket/quota mutation RPC or authenticated factor API was invoked.

Sanitized configuration evidence at **10:21:22.212 UTC**:
`.supabase/backups/onfxxtvfprjnqsxdmhkp-20261026T084803Z/stage-2e8-auth-comparison.json`.
This is an ignored metadata artifact, not a new backup. No Management API token
was extracted or additional privileged credential obtained.

## Invitation template and localhost compatibility

Expected saved **Invite user** HTML action link:

```html
<a href="{{ .SiteURL }}/auth/confirm#token_hash={{ .TokenHash }}&amp;type=invite">Review invitation</a>
```

`&` and HTML `&amp;` are equivalent in this link. The `#` is required; do not use
the old `?token_hash=` form or a direct Supabase verification URL. The allowlist
contains the exact token-free confirmation route, not a wildcard or the entire
invitation fragment. Do not change the Site URL to the production domain.

Saved template HTML was **not independently retrieved** through the CLI.
During Stage 2E.8 the owner freshly checked the saved Invite user action link
in the exact project and replied **“Saved link matches exactly.”** The required
fragment link above is therefore owner-verified. This does not establish an
automatic inspection of the full HTML, a delivery test or invitation approval. The supported
[GET Auth configuration API](https://supabase.com/docs/reference/api/v1-get-auth-service-config)
is another read-only method with appropriate management authorization, but no
extra management credential was retrieved for that purpose.

Code review confirms the current `/auth/confirm` GET is a token-free shell.
The early script reads the fragment into transient memory and immediately
replaces the visible URL with `/auth/confirm`; query-token links fail closed.
Only explicit Continue sends a fixed same-origin POST with `type=invite` and
the token hash in its body. Origin validation, durable one-time tickets,
no-store/no-referrer and checked sign-out remain intact. No real token was
opened, consumed or retried in this stage.

Use the existing private hosted-test launcher after test approval. It binds to
127.0.0.1:3000 and sets `AUTH_TRUSTED_ORIGIN=http://localhost:3000`; the browser
must use localhost, not the numeric loopback hostname. Existing environment
files are preserved, secrets stay server-only, and no recovery override is
enabled. The current fragment/session behavior has prior automated coverage;
those suites and real browser/device tests were not rerun in this config-only
stage.

## Physical authenticators and test-binding boundaries

Prepare two separately controlled, protected authenticator devices with clock
synchronization enabled. The current UI displays a manual setup key, not a QR
image. Import each newly generated factor privately. A copied primary seed is
not an independent backup. First verify the primary, enroll/verify the distinct
backup while AAL2, then sign out/sign in and challenge each factor separately.
Do not share seeds, codes, screenshots, HARs, cookies or passwords. No device
interaction occurred here, so **physical-device testing is not passed**.

The Phase B private permission harness, exact temporary-binding SQL and hosted
cleanup implementation are **not yet present**. The existing runners are local
only and include local fixture/owner-bootstrap/cleanup operations; their guards
must not be removed to point them at the hosted project. This stage reviewed
the design and current server authorization boundary, not nonexistent hosted
execution code. Phase B is blocked until those artifacts are prepared and
reviewed separately.

Current implemented safeguards:

- Invitation/password/MFA flows do not create staff profiles or assign roles.
  An unassigned AAL2 identity remains unauthorized for staff operations.
- `requirePermission` uses verified identity/AAL2, active profile, valid database
  role assignments and the required permission. Browser metadata is not trusted.
- Ordinary API roles cannot mutate team roles; restrictive database policies
  intersect existing permission policies. The privileged Auth-store client has
  only fixed ticket/quota methods and is not a role-provisioning interface.
- The launcher restricts the project, local process, file privacy, trusted
  Origin and disabled recovery. No generic public testing/bootstrap endpoint
  exists and no hosted execution harness ran here.

Required safeguards for the **future** Phase B artifacts, not yet implemented:
parameterize and recheck exact approved UUID/email/run; lock and reject
unexpected existing staff data; require confirmed identity/verified TOTP;
hardcode only the existing `content_community_lead` code; verify its four
permissions; atomically insert one profile/assignment/approval-linked audit;
reject duplicate or other assignments. Never use the owner-bootstrap script,
grant `platform_owner`, alter shared catalogs, or accept browser-supplied roles.
Permission probes must use the actual caller's SSR session, not a service key.

Cleanup needs a distinct exact-UUID approval. Track all created records before
deletion, verify cascaded ticket/profile/assignment/factor/session removal, and
preserve role catalogs and unrelated data. Retain shared global quota counters
and required security audit history; agree retention/exact optional deletions
first. Stop on partial/uncertain outcomes without blind retries. The detailed
[Stage 2E.7 matrix and cleanup plan](./hosted-mfa-integration-readiness.md)
remain the controlling proposal, not authorization.

## Concise manual checklist and approval scope

Before requesting the first invitation:

1. In the exact project's **Authentication → Emails → Templates → Invite user**,
   read the saved action link and confirm it matches the fragment example above.
   Do not send a Dashboard test or edit the template during verification.
2. Prepare the two physical authenticators, private browser profile and independent
   backup-device custody. Device verification will occur only after approval.
3. Identify one owner-controlled, independently verified non-founder mailbox.
   No recipient is selected by this report; no previous invitation authorization
   is carried forward to a new account.
4. Agree the private run ledger, audit/quota retention, sign-in budget (three
   per email/fixed hour) and exact later cleanup scope. Do not bypass quotas.
5. For **Phase A only**, explicitly authorize exactly one disposable Auth
   identity and one invitation to that named mailbox, password setup, primary
   and backup TOTP enrollment/verification, bounded sign-ins/challenges and
   sign-out, including the resulting Auth/session/ticket/quota records. No role
   assignment, password recovery, factor removal or account deletion is included.
6. Review and separately approve Phase B's private harness, exact temporary
   content-role transaction and audit events, then separately approve cleanup.
   Neither approval is implied by Phase A. Founder onboarding is excluded.

Confirmed settings require no correction; the saved invitation link is now
owner-confirmed. Remaining gates are the recipient and precise approval scope, actual device tests,
and Phase B artifact review. Kevin Omgba and Nateu Farhel remain proposed
reviewers only; custodian/executor designation and emergency recovery governance
still need separate agreement before owner activation. No privileges were added.

**Configuration and the saved invitation link are ready for a separately
approved Phase A once device/recipient prerequisites are resolved.** No account-specific
MFA test, email delivery test, temporary binding or cleanup has run here.

Files changed: this report and a current-status link in the Stage 2E.7 plan.
No application, migration, environment file or hosted configuration changed.
