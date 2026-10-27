// Isolated SDK/handler integration with synthetic credentials; ALL HTTP is mocked.
import assert from "node:assert/strict";
import { NextRequest } from "next/server";
import { POST } from "../src/app/auth/sign-out/complete/route";
import { updateSession } from "../src/lib/supabase/proxy";
import { safeCookieDiagnosticLine, COOKIE_DIAGNOSTIC_HEADER } from "../src/lib/auth/cookie-diagnostics";

process.env.NEXT_PUBLIC_SUPABASE_URL = "https://cookie-test.invalid";
process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_publishable_synthetic_diagnostic_only";
process.env.AUTH_TRUSTED_ORIGIN = "http://localhost:3000";
Object.assign(process.env, { NODE_ENV: "development" });
process.env.AUTH_COOKIE_DIAGNOSTICS = "1";
for (const key of ["VERCEL", "NETLIFY", "CF_PAGES", "CI"]) delete process.env[key];
const name = "sb-cookie-test-auth-token";
const user = { id: "11111111-1111-4111-8111-111111111111", aud: "authenticated", role: "authenticated" };
function session(expired = false) {
  const exp = Math.floor(Date.now() / 1000) + (expired ? -3600 : 3600);
  const token = [Buffer.from(JSON.stringify({ alg: "HS256" })).toString("base64url"),
    Buffer.from(JSON.stringify({ sub: user.id, exp, aud: "authenticated", role: "authenticated" })).toString("base64url"), "synthetic"].join(".");
  return { access_token: token, refresh_token: "synthetic-only", expires_at: exp, expires_in: 3600, token_type: "bearer", user };
}
let fail = false;
let calls = 0;
globalThis.fetch = async input => {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  assert.equal(url.origin, "https://cookie-test.invalid"); // Never fall through to real HTTP.
  calls++;
  if (url.pathname === "/auth/v1/logout") return fail ? Response.json({ message: "synthetic-private-error" }, { status: 500 }) : new Response(null, { status: 204 });
  if (url.pathname === "/auth/v1/user") return Response.json(user);
  if (url.pathname === "/auth/v1/token") return Response.json(session());
  throw new Error("Unexpected mock operation");
};
const logs: string[] = [];
console.info = (line: unknown) => { assert.equal(typeof line, "string"); logs.push(line as string); };
async function run(present: boolean, expired = false, proxy = false, failure = false) {
  logs.length = 0; calls = 0; fail = failure;
  const request = new NextRequest("http://localhost:3000/auth/sign-out/complete", {
    method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000", "x-auth-form": "1",
      "content-type": "application/x-www-form-urlencoded", [COOKIE_DIAGNOSTIC_HEADER]: "attacker-controlled",
      ...(present ? { cookie: `${name}=base64-${Buffer.from(JSON.stringify(session(expired))).toString("base64url")}` } : {}) }, body: "",
  });
  if (proxy) await updateSession(request);
  const response = await POST(request);
  for (const line of logs) assert.ok(safeCookieDiagnosticLine(line));
  assert.ok(logs.every(line => !/synthetic|attacker|https?:|token|cookie-test/.test(line)));
  return { response, body: await response.json(), events: logs.map(line => line.split(" ")[3]), ids: logs.map(line => line.split(" ")[1]), calls };
}
async function main() {
const success = await run(true);
assert.ok(success.events.includes("request_cookie_present"));
assert.ok(success.events.includes("sign_out_succeeded"));
assert.ok(success.events.includes("response_deletion_present"));
assert.equal(success.response.cookies.get(name)?.maxAge, 0);
assert.equal(success.response.cookies.get(name)?.path, "/");
assert.equal(new Set(success.ids).size, 1);
const absent = await run(false);
assert.equal(absent.calls, 0);
assert.ok(absent.events.includes("sign_out_missing_session"));
assert.ok(absent.events.includes("response_deletion_absent"));
const failure = await run(true, false, false, true);
assert.ok(failure.events.includes("sign_out_failed"));
assert.ok(failure.events.includes("response_deletion_absent"));
assert.doesNotMatch(failure.body.destination, /You have been signed out|synthetic-private-error/);
const refreshed = await run(true, true, true);
assert.ok(refreshed.events.includes("proxy_cookie_write"));
assert.ok(refreshed.events.includes("response_deletion_present"));
assert.equal(new Set(refreshed.ids).size, 1);
const unchanged = await run(false, false, true);
assert.ok(unchanged.events.includes("proxy_no_cookie_write"));
assert.equal(new Set(unchanged.ids).size, 1);
console.log("Five mocked SDK/route/proxy cookie diagnostic scenarios passed; no real HTTP.");
}
void main().catch(() => { console.error("Mock cookie diagnostic assertion failed; no real HTTP was performed."); process.exitCode = 1; });
