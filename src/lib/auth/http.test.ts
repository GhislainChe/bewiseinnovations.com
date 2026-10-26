import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { authRedirect, formRequestFailure, validFormRequest } from "./http";
import { inspectAuthOrigin, trustedAuthOrigin } from "./origin";

const config = { trustedOrigin: "http://localhost:3000", runtime: "development" };
function request(overrides: Record<string, string> = {}, url = "http://127.0.0.1:3000/auth/confirm/complete") {
  return new NextRequest(url, { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/x-www-form-urlencoded", ...overrides } });
}

test("confirmation form diagnostics distinguish origin, size and encoding without exposing request values", () => {
  assert.equal(formRequestFailure(request(), config), null);
  assert.equal(validFormRequest(request(), config), true);
  assert.equal(formRequestFailure(request({ origin: "http://127.0.0.1:3000" }), config), "origin_rejected");
  assert.equal(formRequestFailure(request({ "content-length": "4097" }), config), "body_size_rejected");
  assert.equal(formRequestFailure(request({ "content-length": "invalid" }), config), "body_size_rejected");
  assert.equal(formRequestFailure(request({ "content-type": "application/json" }), config), "content_type_rejected");
  assert.equal(validFormRequest(request({ origin: "https://untrusted.invalid" }), config), false);
});

test("configured localhost origin works with internal IP request URLs and exact forwarded values", () => {
  const input = request({ "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http" });
  // NextRequest may normalize loopback names; model the raw internal URL explicitly.
  const result = inspectAuthOrigin({ url: "http://127.0.0.1:3000/auth/confirm/complete", headers: input.headers }, config);
  assert.equal(result.allowed, true);
  assert.ok(result.labels.includes("origin_request_url_loopback_ip"));
  assert.ok(result.labels.includes("origin_request_host_localhost"));
  assert.ok(result.labels.includes("origin_reason_matched"));
  assert.equal(inspectAuthOrigin(request({}, "http://localhost:3000/auth/confirm/complete"), config).allowed, true);
});

test("missing, malformed, malicious and incorrect loopback Origins are rejected", () => {
  for (const origin of ["", "null", "http://127.0.0.1:3000", "https://evil.invalid", "http://localhost:3000/path", "http://user@localhost:3000", "http://localhost:3000, https://evil.invalid", "http://localhost:3001"]) {
    assert.equal(inspectAuthOrigin(request({ origin }), config).allowed, false);
  }
  const missing = request(); missing.headers.delete("origin");
  assert.ok(inspectAuthOrigin(missing, config).labels.includes("origin_reason_header_missing"));
});

test("host and forwarded headers cannot choose or bypass the configured trusted origin", () => {
  const cases: Record<string, string>[] = [
    { host: "127.0.0.1:3000" }, { host: "evil.invalid" },
    { "x-forwarded-host": "evil.invalid" }, { "x-forwarded-host": "localhost:3000, evil.invalid" },
    { "x-forwarded-proto": "https" }, { "x-forwarded-proto": "http, https" },
    { origin: "https://evil.invalid", "x-forwarded-host": "localhost:3000" },
  ];
  for (const headers of cases) assert.equal(inspectAuthOrigin(request(headers), config).allowed, false);
});

test("missing or unsafe trusted-origin configuration fails closed", () => {
  for (const value of [undefined, "", "http://localhost:3000/", "http://localhost:3000/path", "https://user:pass@evil.invalid", "http://public.invalid"]) {
    assert.equal(trustedAuthOrigin({ ...config, trustedOrigin: value }), null);
  }
  assert.equal(inspectAuthOrigin(request(), {}).allowed, false);
  assert.equal(trustedAuthOrigin({ ...config, runtime: "production" }), null);
  assert.equal(trustedAuthOrigin({ ...config, managed: true }), null);
  assert.equal(trustedAuthOrigin({ trustedOrigin: "https://admin.example", runtime: "production" })?.origin, "https://admin.example");
});

test("origin diagnostics never include raw URL, headers or query tokens", () => {
  const result = inspectAuthOrigin(request({ origin: "https://private.invalid" }, "http://127.0.0.1:3000/auth/confirm?token_hash=synthetic-sensitive"), config);
  assert.equal(JSON.stringify(result).includes("private.invalid"), false);
  assert.equal(JSON.stringify(result).includes("synthetic-sensitive"), false);
  assert.equal(JSON.stringify(result).includes("http:"), false);
});

test("legitimate confirmation POST passes all form checks with an internal bind URL", async () => {
  const submission = new NextRequest("http://127.0.0.1:3000/auth/confirm/complete", {
    method: "POST", headers: { origin: "http://localhost:3000", host: "localhost:3000",
      "x-forwarded-host": "localhost:3000", "x-forwarded-proto": "http",
      "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ type: "invite", token_hash: "synthetic-test-token-only" }),
  });
  assert.equal(validFormRequest(submission, config), true);
  assert.equal((await submission.formData()).get("type"), "invite");
});

test("authentication redirects use configured canonical origin and fail closed if absent", () => {
  const previous = process.env.AUTH_TRUSTED_ORIGIN;
  try {
    process.env.AUTH_TRUSTED_ORIGIN = "https://admin.example";
    assert.equal(authRedirect(request(), "/auth/set-password").headers.get("location"), "https://admin.example/auth/set-password");
    assert.throws(() => authRedirect(request(), "https://evil.invalid"));
    assert.throws(() => authRedirect(request(), "/auth/error?token_hash=synthetic-only"));
    assert.throws(() => authRedirect(request(), "/auth/error#synthetic-only"));
    delete process.env.AUTH_TRUSTED_ORIGIN;
    assert.equal(authRedirect(request(), "/auth/set-password").headers.get("location"), "/auth/error");
  } finally {
    if (previous === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = previous;
  }
});

test("fetch form responses contain a fixed destination without a redirect cycle", async () => {
  const previous = process.env.AUTH_TRUSTED_ORIGIN;
  try {
    process.env.AUTH_TRUSTED_ORIGIN = "https://admin.example";
    const response = authRedirect(request({ "x-auth-form": "1" }), "/auth/error");
    assert.equal(response.status, 200);
    assert.equal(response.headers.has("location"), false);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
    assert.deepEqual(await response.json(), { destination: "/auth/error" });
  } finally {
    if (previous === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = previous;
  }
});
