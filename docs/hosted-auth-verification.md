# Stage 2D.12 — hosted authentication configuration verification

Verified 24 October 2026 (Africa/Douala), project `onfxxtvfprjnqsxdmhkp`.
All hosted operations in this stage were read-only. No Auth user, message,
credential, setting, schema, role assignment, or migration was created/changed.
The existing local environment files were not edited. No hosted secret key was
retrieved or configured.

## Confirmed configuration

| Setting | Confirmed value | Evidence |
| --- | --- | --- |
| Linked project | `onfxxtvfprjnqsxdmhkp` | Local link, CLI configuration target, hosted API URL |
| Site URL | `http://localhost:3000` | Supported hosted config comparison matches local declaration |
| Additional redirect URLs | Exactly `http://localhost:3000/auth/confirm` | Same comparison, no redirect-list difference |
| Public signup | Disabled | Config comparison and live public Auth settings |
| Email/password provider | Enabled | Live Auth settings `external.email=true` |
| Email confirmation | Required | Live settings `mailer_autoconfirm=false` and config comparison |
| Anonymous sign-in | Disabled | Config comparison matches local false setting |
| Password minimum | 12 characters | Config comparison matches local declaration |
| TOTP enrollment/verification | Enabled | Explicit hosted differences from local disabled TOTP |
| Custom SMTP | Enabled | Explicit SMTP-enabled remote setting |
| Data API schemas | `public`, `graphql_public` | Full API comparison matched local list; no unmanaged API fields |
| Migration history | All three expected versions applied | Fresh SELECT-only hosted catalog check |
| Profiles/assignments/Auth users | Zero | Fresh SELECT-only counts |

Methods: `npx supabase config diff`,
`npx supabase config pull --dry-run --project-ref onfxxtvfprjnqsxdmhkp`,
`node scripts/inspect-hosted-auth-security.mjs`, and
`node scripts/verify-hosted-auth-api.mjs`. The pull was only a dry run and wrote
no configuration. Output was filtered in memory to avoid printing credentials,
SMTP usernames, or unrelated settings. Auth HTTP checks used the existing
publishable key in `apikey`, without treating it as a Bearer JWT.

## Explicitly unverified

- The CLI comparison/preview reports the invite and recovery subjects, but does
  not return template HTML bodies. The user's reported links match the required
  values; their saved bodies were not independently fetched in this stage.
  Supabase's supported [GET Auth config API](https://supabase.com/docs/reference/api/v1-get-auth-service-config)
  includes the body fields, but no additional Management API credential was
  extracted to call it. Use the manual Dashboard review below.
- SMTP password validity, sender-domain SPF/DKIM/DMARC, deliverability, mailbox
  receipt and link rewriting are unverified. SMTP being enabled is not a
  delivery test. No mail was sent.
- No password composition requirement was reported beyond the confirmed minimum.
  Leaked-password protection was not established by these checks.
- Privileged HTTP execution through the application's actual hosted secret key
  is not yet tested; no such key was loaded. Hosted ticket-registration,
  redemption and recovery-quota mutations were deliberately not invoked.
- Real browser session storage/refresh/expiry, actual hosted invitation and
  recovery, and MFA enforcement are not verified by a configuration check.

## Templates and application compatibility

In the exact project's **Authentication > Emails > Templates**, open **Invite
user** and **Reset password** and inspect each saved HTML action link. Expected:

```html
<!-- Invite user -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=invite">Review invitation</a>
<!-- Reset password -->
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=recovery">Review password recovery</a>
```

The HTML `&amp;` becomes `&` in the clicked URL. No credential belongs in either
template. Confirm no tracking rewrites the links and no external assets are
added. Leave the Site URL at localhost and verify the exact confirmation URL
in **Authentication > URL Configuration**. Do not save changes under this
read-only review; report any mismatch for separate approval.

Both links fit the current code. GET `/auth/confirm` accepts only `invite` or
`recovery`, displays an inert form, and makes no OTP-verification call. The
same-origin POST `/auth/confirm/complete` validates the type/token and calls
`verifyOtp({token_hash,type})`. It verifies the returned identity, registers a
short-lived signed ticket, and redirects to the fixed invitation or recovery
password page. React escapes the hidden form values. The private store is
checked before OTP consumption, and successful password handling expires the
exact `/auth` flow cookie. An Auth account without active team provisioning
receives no staff privileges.

## Why the current Auth-store RPC design works

The distinction is the **function's schema**, not the schema of its tables:

```text
Server-only supabase-js .rpc()
  -> public.auth_flow_store_ready / register_auth_flow_ticket /
     redeem_auth_flow_ticket / consume_recovery_budget
  -> app_private.auth_flow_tickets / auth_recovery_buckets
```

The installed Supabase client defaults to `db.schema='public'`. The four
functions actually exist in `public`, which is exposed. The two backing tables
are in non-exposed `app_private`. The client does not use
`.schema('app_private')`; its requests target `/rest/v1/rpc/<name>` in `public`.
There is no requirement to expose `app_private` or grant direct table access.
The SECURITY DEFINER functions use their owner privileges, restricted empty
search paths and schema-qualified references to reach the private tables.

Fresh hosted verification established:

- Exactly the four intended public signatures exist, owned by `postgres`, each
  SECURITY DEFINER with `search_path=''`.
- PUBLIC, `anon` and `authenticated` cannot execute them; `service_role` can.
- Both private tables retain RLS, zero policies and no direct grants to
  `anon`, `authenticated` or `service_role`.
- `node scripts/inspect-hosted-auth-security.mjs --ready` ran the read-only
  `public.auth_flow_store_ready()` as `service_role` using the already trusted
  session-pooler diagnostic connection. Public-schema USAGE and readiness were
  both true. This check used existing CLI database authentication, not a
  retrieved hosted secret API key.
- An actual HTTP POST to the **read-only readiness** endpoint using only the
  publishable key received HTTP 401 / PostgreSQL `42501` (permission denied),
  rather than a missing-function/schema-cache error. This confirms the public
  API resolves that RPC and correctly denies the anonymous caller. It is not
  proof of a successful privileged HTTP call.

**No direct PostgreSQL replacement is required by the observed schema/API
configuration.** The current server-only Supabase client is compatible. After
explicit credential approval, the remaining non-mutating test is its real
`ready()` call with the same project's secret key: success requires boolean
true and no SDK error. Stop on an error and inspect the error code privately;
do not expose the private schema, relax grants, or rotate/change credentials
as a workaround. A trusted database connection would only be a separately
reviewed alternative if a different deployment deliberately removed these
public RPC entry points. No such change is needed here.

References: [database functions](https://supabase.com/docs/guides/database/functions),
[API schemas](https://supabase.com/docs/guides/api/using-custom-schemas).

## Localhost clients, credentials, and gates

The browser client uses only the hosted URL and publishable key. The public
Auth settings request accepted that key. Server Components and Route Handlers
use request-scoped SSR clients and preserve cookie options/refresh headers;
the proxy verifies claims and sets no-store/no-referrer/noindex. The cookie
domain is the application host, so localhost development can use the HTTPS
Supabase URL without changing it to a local database URL. Use `localhost`, not
interchangeably `127.0.0.1`, in browser URLs. The development server should bind
only to `127.0.0.1`; never publish it through a tunnel.

Before an approved invitation test, the operator must manually configure:

- The exact hosted URL and its publishable key.
- A strong server-only `AUTH_FLOW_SIGNING_SECRET`.
- `SUPABASE_AUTH_STORE_SECRET_KEY` from this exact project's secret keys in
  **Project Settings > API Keys**, transferred only after explicit approval to
  an encrypted server environment or approved ignored hosted-test environment
  file. Never paste it in chat, command arguments/history, or browser tooling.
  Never reuse the local service-role credential against hosted Supabase.

No recovery-testing override is needed to accept an invitation. Recovery stays
disabled for hosted URLs unless the separately approved server environment has
both `AUTH_RECOVERY_MODE=hosted-local-test` and
`AUTH_RECOVERY_TEST_ORIGIN=http://localhost:3000`. Even then, it requires a
development runtime, exact request origin/Host and project, no conflicting
forwarding headers, no managed-deployment/CI marker, working credentials and
the shared limiter. Production runtime cannot use this override. No flag was
enabled here. See [the configuration guide](./hosted-auth-configuration.md).

## Separately approved invitation-delivery test

1. Obtain explicit approval for one verified owner-controlled disposable mailbox,
   account creation, one invitation email, and deletion of that test identity.
   Do not use a founder email or guess a recipient. Keep the address and Auth
   UUID in private operational records, not this repository.
2. Confirm the exact Dashboard project, the saved template bodies above, the
   localhost URLs, and the current signup/password settings. Verify no existing
   Auth account uses the approved mailbox. An unexpected account is a stop.
3. Configure credentials manually only after approval. In a trusted server-only
   context, call the existing store `ready()` and require true. Stop before
   sending if configuration, RPC access, or logging protection fails. No public
   credential/diagnostic endpoint is permitted.
4. Use a clean browser on the machine running the loopback-only app. For
   invitation acceptance, `npm run build` then
   `npm run start -- --hostname 127.0.0.1 --port 3000` is sufficient. Protect
   request logs/telemetry against query strings, form bodies, cookies and tokens;
   do not export HAR files or use debugging extensions that capture them.
5. In **Authentication > Users > Add user > Send invitation**, send exactly one
   invitation to the approved mailbox after checking the target again. Record
   only the time, actual test UUID and delivery status privately. Do not manually
   confirm email, insert a profile, assign a role, or set a guessed password.
6. Inspect inbox/spam and sender authentication. Open the link on that local
   machine. GET/refresh must leave the link usable; Continue must POST and show
   password setup. Inspect cookie attributes without retaining values. Save a
   strong password and confirm pending activation, flow-cookie removal and local
   sign-out. Do not retry a used/expired token; request separate resend approval.
7. Confirm zero staff profile/role assignments for the actual UUID and use a
   separately reviewed local server-only authorization probe with the user's
   ordinary session to demonstrate staff denial. A 404 alone is not evidence.
   Recovery testing requires its own send approval, development-only gate and
   logging controls; do not use it automatically after the invitation test.
8. Revoke/sign out sessions and delete only the reviewed disposable Auth UUID
   through the Dashboard/admin API. Its private ticket rows cascade on deletion.
   Confirm no test identity, profile, assignment or associated ticket remains.
   Remove only explicitly approved test-email quota records if created; preserve
   global quotas and audit evidence. Clear browser site data, remove test mail,
   stop the server and disable temporary testing credentials/gates. Account
   deletion may not instantly invalidate already-issued access JWTs.

On delivery failure, inspect **Logs > Auth** and provider records around the
test timestamp. Share only sanitized status/code and request ID. Do not share
SMTP passwords, raw logs, recipient addresses, cookies or live message links.
Sending being accepted is not proof of mailbox delivery.

## Validation and readiness decision

Authentication tests: 37/37 passed. TypeScript, ESLint and production build
passed. Static browser artifacts contained no private Auth-store configuration
or testing-switch references. These are local validation results; hosted
Auth mutation/email end-to-end and real browser session behavior remain untested.

The URL/provider/password configuration and RPC architecture are compatible.
The remaining gates are saved-template-body inspection, approved hosted secret
configuration plus successful privileged HTTP `ready()`, logging/browser checks,
and explicit recipient/account/email/cleanup approval. SMTP delivery remains
unverified. No account or email was created to make this readiness claim.
