# BE WISE INNOVATIONS

Official website foundation — Stage 2C.1: internal authentication backend.

## Requirements

- Node.js 20.9 or newer (use a currently supported LTS release for deployment).
- npm 10 or newer. The initial setup was validated with Node.js 20.20.1 and npm 10.8.2.

## Local development

Run commands from this project root:

```sh
npm ci
npm run dev
```

Open http://localhost:3000. Stop the server with Ctrl+C.
Dependencies are already installed in the initial workspace; `npm ci` is for a
fresh checkout or a clean reinstall using the committed `package-lock.json`.

The placeholder homepage still runs without Supabase configuration. Supabase client
factories validate settings only when called. Configure `.env.local` before any
Supabase operation; never commit it. `NEXT_PUBLIC_*` values are public browser
configuration. Secret keys and database passwords must remain server-only.

## Validation and production startup

```sh
npm run lint
npm run typecheck
npm run build
npm run start
```

`start` serves the production build at http://localhost:3000 and requires a
successful build first. `typecheck` generates Next.js route types before running
TypeScript, including on a fresh checkout. Lint runs separately from the build.
No deployment is configured in Stage 1.

## Structure

```text
public/                 Static assets (empty placeholder)
src/
  app/                  App Router layout, placeholder page, global Tailwind import
  components/           Future shared UI components
  features/             Future feature-specific modules
  lib/                  Future shared utilities and integrations
    db/                 Future Supabase/PostgreSQL integration
    supabase/           Browser/server clients and public configuration validation
    auth/               Internal staff authentication and authorization utilities
  types/                Future cross-feature TypeScript types
scripts/                Read-only Supabase connectivity check
supabase/               CLI config and future version-controlled SQL migrations
.env.example            Credential-free future environment documentation
.gitignore              Secrets, dependency, build, and local-cache exclusions
eslint.config.mjs       Next.js and TypeScript ESLint rules
next.config.ts          Next.js configuration
package.json            Dependencies and development commands
package-lock.json       Exact resolved dependency tree; commit this file
postcss.config.mjs      Tailwind CSS PostCSS integration
tsconfig.json           Strict TypeScript and @/* -> src/* alias
```

Reserved source folders contain short README files so their purpose is clear and
they remain tracked without adding speculative application code.

## Technical decisions

- Next.js App Router with TypeScript in strict mode; server components remain the
  default. The root route is only a plain initialization placeholder, not a UI design.
- `@/*` maps to `src/*`, allowing imports such as `@/components/...` without deep
  relative paths. Keep route files in `app` and future domain logic in `features`.
- Tailwind CSS uses its PostCSS plugin and a CSS import. No theme or design system
  is introduced yet.
- ESLint uses the Next.js Core Web Vitals and TypeScript presets. Warnings fail
  validation. Stage 2C.1 uses dev-only `tsx` with Node's built-in test runner
  for mocked authentication unit tests.
- Direct dependencies are pinned and npm's lockfile captures transitive versions.
- TypeScript is pinned to 5.9.3 because the tooling reported peer conflicts with
  TypeScript 7 during initialization; upgrades should pass all validation commands.
- No external fonts, third-party assets, or credentials are needed to build.
- The `X-Powered-By` header is disabled to avoid unnecessary framework disclosure.
- The project was initialized directly in this root. The automatic starter refused
  to proceed after the local PowerShell environment generated a `Microsoft/` cache
  directory; that cache is preserved and ignored.

## Deferred scope

Authentication screens, account provisioning, server-side role mutation workflows,
the admin dashboard, website UI/UX, and English/French localization are not implemented.
Services, requests, inquiries, portfolio, products/waitlists, community events,
content management, contact, and WhatsApp integration await later stages.

Confirmed role assignments, pending verified Auth accounts:

| Team member | Role |
| --- | --- |
| Ndong Ghislain Che | Platform Owner |
| Kevin Omgba | Technical Lead |
| Nateu Farhel | Operations Lead |
| Divine Nguemo | Content & Community Lead |

## Supabase foundation

This checkout targets the **existing** Supabase project
`onfxxtvfprjnqsxdmhkp` (`https://onfxxtvfprjnqsxdmhkp.supabase.co`). The
browser and request-scoped server factories are in `src/lib/supabase/`. They use
the publishable key with `@supabase/ssr` and cookie storage. No secret key is used.
The factories are unused by the placeholder page, so builds work without credentials.
Stage 2C.1 adds request-scoped staff authorization utilities and a Next.js 16
session-refresh proxy for future internal routes. See the
[authentication architecture and provisioning plan](docs/authentication.md).

To configure local development, open the existing project in the
[Supabase Dashboard](https://supabase.com/dashboard/project/onfxxtvfprjnqsxdmhkp)
and copy the **publishable** key from **Settings → API Keys** (or the Connect
dialog). Set these in the ignored `.env.local` file in the project root:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://onfxxtvfprjnqsxdmhkp.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_YOUR_DASHBOARD_VALUE
```

The workspace already had `.env.local`, so Stage 2A preserved it. Do not paste
access tokens, service-role/secret keys, or database passwords into chat or into
`NEXT_PUBLIC_*` variables. Never print keys in logs. Confirm the URL and key are
for this project. The configured local publishable key was verified successfully.
To repeat the read-only check, run:

```sh
npm run supabase:check
```

This calls Supabase's `/auth/v1/health` endpoint with the key in the `apikey`
header, then sends an intentionally invalid key as a negative control. It reads
only HTTP statuses; it never prints keys or response bodies. The original check
used `/rest/v1/`, whose HTTP 401 was not evidence that the publishable key was
invalid. The health check confirms API gateway acceptance but does not prove
database table access, RLS behavior, or authenticated sessions. It requires
`.env.local` and network access and has no public web route.

### CLI and migrations

The Supabase CLI is a pinned npm development dependency. Run it from the project
root with `npx supabase`. `supabase/config.toml` configures the local CLI project;
remote association is recorded by `supabase link`, not by changing the local
`project_id` in that file. Stage 2B adds two local migrations and a pgTAP suite;
see [database RBAC design and bootstrap plan](docs/database-rbac.md).

If this machine is not signed in, authenticate through Supabase's browser flow:

```sh
npx supabase login
```

Then link **only** the existing project:

```sh
npx supabase link --project-ref onfxxtvfprjnqsxdmhkp
```

This workspace's CLI was already authenticated and linked successfully to that
reference in Stage 2A. A fresh checkout or another machine must link separately.
The CLI stores its local link under ignored `supabase/.temp/`; the committed
`supabase/config.toml` uses a separate local project identifier. Local Supabase
uses Docker Desktop. Its Auth signup settings are disabled in local config;
the hosted Auth settings must be checked separately before provisioning.

The CLI may request the project's database password during linking; enter it in
your own terminal, never in source files or chat. Local linking does not deploy a
migration. Later database changes should be written as numbered SQL files using
`npx supabase migration new <name>`, reviewed, tested locally, and only applied to
the remote database in a later approved stage. The Stage 2B files are not pushed.
Never use `db reset --linked` on this project: it resets the remote schema.

## Dependency follow-up

The high-severity advisory [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/ghsa-vfj7-8cjw-p6xm)
affects `braces` through 3.0.3. The installed development-only chain is
`eslint-config-next → @next/eslint-plugin-next → fast-glob → micromatch → braces`.
npm reports five high-severity entries because it includes affected ancestors in
the same chain. GitHub currently lists no patched `braces` release. npm's offered
automatic fix downgrades `eslint-config-next` to 14.x, so it was not applied to
this Next.js 16 project. Track an upstream compatible fix and rerun `npm audit`
before deployment. This chain is used by lint tooling; it is not loaded by the
website at runtime. Do not pass untrusted glob patterns to development tooling.

ESLint 9.39.5 is deprecated upstream but retained because the bundled React lint
plugin declares support through ESLint 9. Upgrade the lint stack together once
its peer dependencies support the newer major version.
