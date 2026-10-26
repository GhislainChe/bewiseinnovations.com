import assert from "node:assert/strict";
import { test } from "node:test";
import { createAuthFormSubmitter } from "./form-submit";
import { confirmationInput } from "./confirmation-input";

test("authentication submit uses explicit CORS, no-referrer, session cookies and no automatic redirects", async () => {
  let calls = 0;
  const paths: string[] = [];
  const fetcher: typeof fetch = async (_input, init) => {
    calls++;
    assert.equal(init?.mode, "cors");
    assert.equal(init?.referrerPolicy, "no-referrer");
    assert.equal(init?.credentials, "same-origin");
    assert.equal(init?.cache, "no-store");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("x-auth-form"), "1");
    return Response.json({ destination: "/auth/set-password" });
  };
  const submit = createAuthFormSubmitter(fetcher, "http://localhost:3000", path => paths.push(path));
  const body = new URLSearchParams({ type: "invite", token_hash: "synthetic-value-only" });
  assert.equal(await submit("/auth/confirm/complete", body), "navigating");
  assert.deepEqual(paths, ["/auth/set-password"]);
  assert.equal(calls, 1);
});

test("concurrent clicks and repeats send exactly one request", async () => {
  let calls = 0;
  let resolve!: (response: Response) => void;
  const response = new Promise<Response>(r => { resolve = r; });
  const submit = createAuthFormSubmitter(async () => { calls++; return response; }, "http://localhost:3000", () => {});
  const first = submit("/auth/confirm/complete", new URLSearchParams());
  assert.equal(await submit("/auth/confirm/complete", new URLSearchParams()), "duplicate");
  resolve(Response.json({ destination: "/auth/error" }));
  assert.equal(await first, "navigating");
  assert.equal(await submit("/auth/confirm/complete", new URLSearchParams()), "duplicate");
  assert.equal(calls, 1);
});

test("failed or uncertain requests never automatically retry or navigate", async () => {
  let calls = 0;
  const submit = createAuthFormSubmitter(async () => { calls++; throw new Error("private provider details"); }, "http://localhost:3000", () => assert.fail("No navigation"));
  assert.equal(await submit("/auth/confirm/complete", new URLSearchParams()), "failed");
  assert.equal(await submit("/auth/confirm/complete", new URLSearchParams()), "duplicate");
  assert.equal(calls, 1);
});

test("external, invalid and looping destinations cannot trigger browser navigation", async () => {
  for (const destination of ["https://evil.invalid/auth/error", "//evil.invalid/auth/error", "/auth/confirm/complete", "/auth/confirm", "/internal", "/auth/error?token_hash=synthetic", "/auth/error#synthetic"]) {
    const submit = createAuthFormSubmitter(async () => Response.json({ destination }), "http://localhost:3000", () => assert.fail("No navigation"));
    assert.equal(await submit("/auth/confirm/complete", new URLSearchParams()), "failed");
  }
});

test("confirmation input classification distinguishes type, missing fields and token length", () => {
  assert.deepEqual(confirmationInput("x", "invite"), { ok: false, reason: "input_token_length_invalid" });
  assert.deepEqual(confirmationInput(null, "invite"), { ok: false, reason: "input_token_missing" });
  assert.deepEqual(confirmationInput("synthetic-token-only", "signup"), { ok: false, reason: "input_type_invalid" });
  assert.equal(confirmationInput("synthetic-token-only", "invite").ok, true);
  assert.equal(confirmationInput(["synthetic-token-only"], "invite").ok, false);
});
