import assert from "node:assert/strict";
import { test } from "node:test";
import { spawnSync } from "node:child_process";
import { authCookieNameMatches, cookieDiagnosticsEnabled, diagnosticId, isAuthCookieDeletion, safeCookieDiagnosticLine } from "./cookie-diagnostics";

test("cookie diagnostics are opt-in development-only on the exact trusted localhost origin", () => {
  const env = { AUTH_COOKIE_DIAGNOSTICS: "1", NODE_ENV: "development", AUTH_TRUSTED_ORIGIN: "http://localhost:3000" };
  assert.equal(cookieDiagnosticsEnabled(env), true);
  for (const override of [{ AUTH_COOKIE_DIAGNOSTICS: undefined }, { NODE_ENV: "production" }, { NODE_ENV: "test" },
    { AUTH_TRUSTED_ORIGIN: "https://public.example" }, { VERCEL: "1" }, { NETLIFY: "1" }, { CF_PAGES: "1" }, { CI: "1" }]) {
    assert.equal(cookieDiagnosticsEnabled({ ...env, ...override }), false);
  }
});

test("only exact project cookie names and numeric chunks match", () => {
  for (const suffix of ["", ".0", ".12"]) assert.ok(authCookieNameMatches(`sb-project-auth-token${suffix}`, "https://project.supabase.co"));
  for (const name of ["sb-other-auth-token", "sb-project-auth-token.evil", "sb-project-auth-token-code-verifier", "auth_flow"]) {
    assert.equal(authCookieNameMatches(name, "https://project.supabase.co"), false);
  }
});

test("deletion classification requires the expected project, root host-only scope and expiry", () => {
  const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://project.supabase.co";
  try {
    const cookie = { name: "sb-project-auth-token", path: "/", maxAge: 0 };
    assert.ok(isAuthCookieDeletion(cookie));
    assert.ok(isAuthCookieDeletion({ ...cookie, maxAge: undefined, expires: new Date(0) }));
    assert.equal(isAuthCookieDeletion({ ...cookie, maxAge: 400, expires: new Date(0) }), false);
    for (const change of [{ path: "/auth" }, { domain: "localhost" }, { maxAge: 400 }, { name: "auth_flow" }]) {
      assert.equal(isAuthCookieDeletion({ ...cookie, ...change }), false);
    }
  } finally {
    if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
  }
});

test("diagnostic schema accepts only generated-format IDs, fixed phases and events", () => {
  const id = diagnosticId("raw-private-value");
  const line = `auth_cookie ${id} sign_out sign_out_failed`;
  assert.equal(safeCookieDiagnosticLine(line), line);
  for (const invalid of [line + " private", line + "\n", line.replace("sign_out_failed", "private"), line.replace(id, "secret")]) {
    assert.equal(safeCookieDiagnosticLine(invalid), null);
  }
});

test("actual sign-out handler and SSR/proxy adapters emit safe metadata across five mocked scenarios", () => {
  const child = spawnSync(process.execPath, ["--conditions=react-server", "--import", "tsx", "scripts/test-signout-cookie-diagnostics.ts"], { encoding: "utf8", timeout: 30000, windowsHide: true });
  assert.equal(child.status, 0, "Isolated mock diagnostic runner failed; inspect only synthetic test output locally.");
});
