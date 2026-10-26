# Stage 2D.13 — hosted test credential readiness

Project: `onfxxtvfprjnqsxdmhkp`. Prepared 24 October 2026 (Africa/Douala).
No account, invitation/recovery email, role assignment, hosted setting, data
mutation, migration or website deployment is authorized by this stage.

## Current status

- Linked project and hosted URL/redirect configuration were reconfirmed through
  the supported read-only CLI config comparison.
- `.env.hosted-auth-test.local` was created as a separate Git-ignored file.
  The existing `.env.local` and `.env.integration.local` values were preserved.
- Only the existing same-project **public** URL/publishable key were copied into
  the dedicated file. The owner subsequently entered the hosted privileged key
  privately in the IDE; no credential was retrieved automatically.
- A separate signing secret was generated directly into the private file with
  `crypto.randomBytes(32)`, encoded as 64 hexadecimal characters. No value was
  printed. This provides 256 bits of generated randomness; mere string length
  alone would not prove a manually chosen secret is strong.
- The Windows file ACL was restricted to the current account, with inheritance
  disabled. The check/launcher revalidate the ACL before loading credentials.
- Recovery is explicitly disabled in the dedicated file.
- After the owner's configuration confirmation, `npm run auth:hosted:check`
  passed using the application's actual privileged server client against the
  exact hosted project. The read-only readiness RPC succeeded without any
  table writes. No credential value was displayed.

## Manual credential entry — never send the value to chat

1. Open [this exact project](https://supabase.com/dashboard/project/onfxxtvfprjnqsxdmhkp).
   Confirm the reference in the address bar and **Project Settings > General**.
   The application target must remain
   `https://onfxxtvfprjnqsxdmhkp.supabase.co`.
2. Open **Project Settings > API Keys**. Choose an existing **secret key** for
   this project (`sb_secret_...`). Do not choose a publishable key, another
   project, a JWT signing secret, an SMTP password, Management API access token,
   or anything printed by local `supabase status`. If creating a new hosted key
   is necessary, stop and obtain separate permission for that setting change.
3. In the local IDE, open `.env.hosted-auth-test.local`. Enter the key directly
   after `SUPABASE_AUTH_STORE_SECRET_KEY=` and save it. Do not paste it into
   terminal commands, process arguments, chat, logs, screenshots or docs. Clear
   the clipboard afterward and avoid clipboard-history/sync tools for secrets.
4. Leave the generated `AUTH_FLOW_SIGNING_SECRET`, exact project URL/public
   key, `AUTH_RECOVERY_MODE=disabled`, and empty
   `AUTH_RECOVERY_TEST_ORIGIN=` unchanged. Do not copy the privileged key into
   either existing environment file. Do not add a `NEXT_PUBLIC_` alias.
5. Confirm Git still ignores the file:

   ```powershell
   git check-ignore .env.hosted-auth-test.local
   ```

   Do not use `Get-Content`, `type`, `echo`, environment dumps or a diff to
   display the private file. If the editor changes its ACL during save, the
   readiness tool will refuse to proceed; review permissions locally rather
   than disabling the check. Never force-add the file to Git.

The legacy service-role JWT is also supported if explicitly selected from this
same project's legacy API keys. Its decoded role/ref are checked before a
request; this is only a defensive format check, not JWT verification. An opaque
modern key cannot be mapped to a project offline. The exact Dashboard selection
and successful gateway-authenticated readiness result establish the match.
See [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys).

## Read-only readiness command

After private entry, run:

```powershell
npm run auth:hosted:check
```

This standalone server-side command:

- checks the local process is not production or a known managed/CI deployment;
- checks the exact linked reference, Git exclusion, regular-file identity and
  private file permissions;
- parses only the dedicated file, rejecting unknown/duplicate variable names,
  unsafe target URLs, missing keys/signing secret, or enabled recovery;
- overrides relevant inherited environment variables with the validated file
  values, preventing a local service-role credential from silently winning;
- imports the application's actual `server-only` Auth-store factory and calls
  **only** `ready()`, which invokes `public.auth_flow_store_ready` over HTTPS;
- has a twenty-second watchdog and prints only a status. No key, token, raw
  response, request headers, or provider error payload is printed.

The npm command uses Node's `react-server` export condition only to load the
existing `server-only` module in this administrative CLI. It adds no route or
public endpoint, and the browser/server boundary in the application is unchanged.

Success is `Hosted Auth-store readiness PASSED for the approved project.`
Incomplete configuration prints that the RPC was **not executed**, exits
nonzero, and requires manual completion. A failed readiness result is a stop:
review the exact project/key and network locally. Do not relax grants, expose
`app_private`, change credentials automatically, retry indefinitely, or send an
invitation to diagnose it. The function returns SELECT true and performs no
table writes; no registration, redemption or quota RPC is called.

## Restricted local application launcher

For a later approved browser test, first pass the check above, then use:

```powershell
npm run auth:hosted:dev
```

The launcher validates the dedicated configuration and binds Next.js development
only to **127.0.0.1:3000**. Visit **http://localhost:3000**. It accepts no bind/port
arguments, refuses production/managed environments, suppresses child process
request logs so token-bearing URLs are not echoed, and keeps recovery disabled.
Stage 2D.15 added exact-label-only terminal filtering and a local-only startup
probe: `auth_preflight ready` confirms prerequisites inside the Next.js process.
No raw output is forwarded; no diagnostic HTTP endpoint is created. See the
[failure investigation](./hosted-invitation-failure-review.md).
It does not inherit the parent's special `react-server` Node argument. Ctrl+C
stops only that launched process tree, including its Next.js worker on Windows.
Do not publish the listener through a tunnel or reverse proxy, and stop other
instances using port 3000 before starting. The app was not started in this
preparation stage.

Only the intended public variables may reach browser code. The service-role key
remains in a `server-only` module with persistence/refresh/URL detection off.
The dedicated filename is not one of Next.js's automatically loaded dotenv
filenames; ordinary build/test commands continue using the existing environment.
Do not run the local Mailpit harness with hosted credentials or change its
loopback-only guard.

The disabled recovery setting is intentional for Stage 2D.13. A separately
approved future recovery test must use the reviewed Stage 2D.11 gate and a
correspondingly reviewed launcher; changing this file to enable recovery makes
these preparation tools refuse to run. No account or email operation is added
to any of these commands.

## Repeat preparation and cleanup

`npm run auth:hosted:prepare` creates the file only when absent. Existing files
are preserved; it will not replace a user-entered key or rotate the signing
secret on rerun. It does not retrieve hosted keys. Retain secrets only for the
approved testing period, avoid cloud-synced/shared folders and IDE sharing, and
remove/rotate them through the normal secure procedure after testing. Any
rotation of a hosted key requires its own approval. Signing-key rotation
invalidates outstanding flow tickets and changes quota HMAC identifiers.

Private credential entry and the read-only readiness check are complete.
Separately approve the one-recipient invitation/account/cleanup scope described in
[hosted Auth verification](./hosted-auth-verification.md). SMTP delivery and
real-browser end-to-end behavior remain unverified until that later test.

## Validation

41/41 authentication/configuration unit tests passed, including same-project
guards, missing secrets, disabled recovery, duplicate dotenv entries and refusal
in managed/production contexts. TypeScript, ESLint and production build passed.
These tests use synthetic values and create no Auth users or messages. No
credential value is included in committed code, documentation or test output.
