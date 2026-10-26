import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import { endCurrentSession, SIGN_OUT_FAILED } from "./sign-out";
import { passwordCompletionResponse } from "./password-response";

test("sign-out success, returned errors and thrown failures are handled without exposing errors", async () => {
  assert.equal(await endCurrentSession({ signOut: async () => ({ error: null }) }), true);
  assert.equal(await endCurrentSession({ signOut: async () => ({ error: new Error("private-provider-value") }) }), false);
  assert.equal(await endCurrentSession({ signOut: async () => { throw new Error("private-provider-value"); } }), false);
});

test("failed sign-out clears the flow cookie and never shows pending activation or session success", async () => {
  const previous = process.env.AUTH_TRUSTED_ORIGIN;
  process.env.AUTH_TRUSTED_ORIGIN = "https://admin.example";
  try {
    const request = new NextRequest("https://admin.example/auth/set-password/complete", { method: "POST", headers: { "x-auth-form": "1" } });
    const response = passwordCompletionResponse(request, "invite", { kind: "sign_out_failed" });
    const body = await response.json();
    assert.equal(new URL(body.destination, "https://admin.example").searchParams.get("message"), SIGN_OUT_FAILED);
    assert.doesNotMatch(JSON.stringify(body), /pending activation|private-provider-value/);
    assert.equal(response.cookies.get("auth_flow")?.maxAge, 0);
    assert.equal(response.cookies.get("auth_flow")?.path, "/auth");
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
  } finally {
    if (previous === undefined) delete process.env.AUTH_TRUSTED_ORIGIN;
    else process.env.AUTH_TRUSTED_ORIGIN = previous;
  }
});
