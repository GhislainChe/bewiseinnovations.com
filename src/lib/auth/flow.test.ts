import assert from "node:assert/strict";
import { test } from "node:test";
import { confirmationType, flowCookieOptions, issueFlowTicket, passwordIssue, readFlowTicket, sameOrigin } from "./flow";

test("only invitation and recovery token types are accepted", () => {
  assert.equal(confirmationType("invite"), "invite");
  assert.equal(confirmationType("recovery"), "recovery");
  for (const value of [undefined, "", "signup", "email", "INVITE"]) assert.equal(confirmationType(value), null);
});

test("form origins must be same-origin", () => {
  assert.equal(sameOrigin("http://localhost:3000/auth/confirm", "http://localhost:3000"), true);
  assert.equal(sameOrigin("http://localhost:3000/auth/confirm", "https://evil.example"), false);
  assert.equal(sameOrigin("http://localhost:3000/auth/confirm", null), false);
});

test("passwords require confirmation and at least 12 characters", () => {
  assert.equal(passwordIssue("short", "short"), "Use at least 12 characters.");
  assert.equal(passwordIssue("long-enough-password", "different-password"), "Passwords do not match.");
  assert.equal(passwordIssue("long-enough-password", "long-enough-password"), null);
});

test("flow cookies are HttpOnly, path-scoped, and Secure on HTTPS", () => {
  assert.deepEqual(flowCookieOptions("https:"), {
    httpOnly: true, sameSite: "lax", secure: true, path: "/auth", maxAge: 600,
  });
  assert.equal(flowCookieOptions("http:").secure, false);
});

test("flow tickets are signed, user-bound, type-bound, and expire", () => {
  const previous = process.env.AUTH_FLOW_SIGNING_SECRET;
  process.env.AUTH_FLOW_SIGNING_SECRET = "local-test-only-secret-at-least-thirty-two-chars";
  try {
    const ticket = issueFlowTicket("recovery", "user-1");
    assert.equal(readFlowTicket(ticket, "recovery", "user-1"), true);
    assert.equal(readFlowTicket(ticket, "invite", "user-1"), false);
    assert.equal(readFlowTicket(ticket, "recovery", "user-2"), false);
    assert.equal(readFlowTicket(ticket + "x", "recovery", "user-1"), false);
    assert.equal(readFlowTicket(undefined, "recovery", "user-1"), false);
    const now = Date.now;
    Date.now = () => now() + 11 * 60_000;
    try { assert.equal(readFlowTicket(ticket, "recovery", "user-1"), false); }
    finally { Date.now = now; }
  } finally {
    if (previous === undefined) delete process.env.AUTH_FLOW_SIGNING_SECRET;
    else process.env.AUTH_FLOW_SIGNING_SECRET = previous;
  }
});
