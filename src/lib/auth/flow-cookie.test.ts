import assert from "node:assert/strict";
import { test } from "node:test";
import { NextResponse } from "next/server";
import { clearFlowCookie, setFlowCookie } from "./flow-cookie";

// Path-aware cookie identity semantics, exercising real Next.js Set-Cookie output.
function applyCookies(response: NextResponse, jar: Map<string, string>) {
  for (const cookie of response.cookies.getAll()) {
    const key = `${cookie.name}:${cookie.domain ?? "host-only"}:${cookie.path}`;
    if (cookie.maxAge === 0 || (cookie.expires !== undefined && Number(cookie.expires) <= Date.now())) jar.delete(key);
    else jar.set(key, cookie.value);
  }
}

for (const protocol of ["http:", "https:"]) {
  test(`flow cookie is removed at its exact host/path on ${protocol}`, () => {
    const jar = new Map<string, string>();
    const creation = NextResponse.json({});
    setFlowCookie(creation, "synthetic-test-ticket", protocol);
    const cookie = creation.cookies.get("auth_flow")!;
    assert.equal(cookie.path, "/auth");
    assert.equal(cookie.domain, undefined);
    assert.equal(cookie.httpOnly, true);
    assert.equal(cookie.sameSite, "lax");
    assert.equal(cookie.secure, protocol === "https:");
    assert.equal(cookie.maxAge, 600);
    applyCookies(creation, jar);
    assert.equal(jar.size, 1);
    const wrongPath = NextResponse.json({});
    wrongPath.cookies.delete("auth_flow");
    applyCookies(wrongPath, jar);
    assert.equal(jar.size, 1);
    const deletion = NextResponse.json({});
    clearFlowCookie(deletion, protocol);
    const expired = deletion.cookies.get("auth_flow")!;
    assert.equal(expired.path, cookie.path);
    assert.equal(expired.domain, cookie.domain);
    assert.equal(expired.httpOnly, true);
    assert.equal(expired.sameSite, "lax");
    assert.equal(expired.secure, cookie.secure);
    assert.equal(expired.value, "");
    assert.equal(expired.maxAge, 0);
    assert.equal(Number(expired.expires), 0);
    assert.match(deletion.headers.get("set-cookie")!, /Path=\/auth/);
    assert.match(deletion.headers.get("set-cookie")!, /Max-Age=0/i);
    applyCookies(deletion, jar);
    assert.equal(jar.size, 0);
  });
}
