import assert from "node:assert/strict";
import { test } from "node:test";
import { request as httpRequest } from "node:http";
import { allowedPermissionRequest, createPermissionBridge, permissionSummary, contentCodes, deniedCodes, validPermissionApproval, validPermissionPost } from "./permission-session-bridge";

test("permission transport allows only fixed project read paths; refresh, logout, RPCs and writes are blocked", () => {
  const origin = "https://onfxxtvfprjnqsxdmhkp.supabase.co";
  assert.ok(allowedPermissionRequest(new URL(origin + "/auth/v1/user"), "GET"));
  assert.ok(allowedPermissionRequest(new URL(origin + "/rest/v1/team_profiles?select=id"), "HEAD"));
  for (const [url, method] of [[origin + "/auth/v1/logout", "POST"], [origin + "/auth/v1/token?grant_type=refresh_token", "POST"],
    [origin + "/rest/v1/team_role_assignments", "POST"], [origin + "/rest/v1/team_profiles", "DELETE"],
    [origin + "/rest/v1/rpc/auth_flow_store_ready", "GET"], [origin + "/rest/v1/customers", "GET"],
    ["https://external.invalid/rest/v1/team_profiles", "GET"]]) assert.equal(allowedPermissionRequest(new URL(url), method), false);
});

function result(aal: "aal1" | "aal2") {
  return { aal, decisions: Object.fromEntries([...contentCodes.map(code => [code, aal === "aal2"]), ...deniedCodes.map(code => [code, false])]),
    ownProfileCount: aal === "aal2" ? 1 : 0, ownAssignmentCount: aal === "aal2" ? 1 : 0, visibleAuditCount: 0 };
}

test("session bridge summarizes only known fields and rejects unexpected permission/RLS outcomes", () => {
  assert.equal(permissionSummary(result("aal1"), "aal1").passed, true);
  assert.equal(permissionSummary(result("aal2"), "aal2").passed, true);
  assert.equal(permissionSummary(result("aal1"), "aal2").passed, false);
  assert.equal(permissionSummary({ ...result("aal2"), decisions: { ...result("aal2").decisions, "roles.assign": true } }, "aal2").passed, false);
  assert.equal(permissionSummary({ ...result("aal2"), ownProfileCount: 0 }, "aal2").passed, false);
  assert.equal(permissionSummary({ ...result("aal2"), visibleAuditCount: 1 }, "aal2").passed, false);
  const unsafe = { ...result("aal2"), aal: "private-value", cookie: "private-value" };
  assert.doesNotMatch(JSON.stringify(permissionSummary(unsafe, "aal2")), /private-value|cookie/);
});

test("session bridge requires exact Host/Origin, nonce, empty body and no forwarding", () => {
  const good = { host: "localhost:3012", origin: "http://localhost:3012", "x-permission-probe": "test-nonce" };
  assert.equal(validPermissionPost(good, "test-nonce"), true);
  for (const change of [{ host: "127.0.0.1:3012" }, { origin: undefined }, { origin: "null" }, { origin: "http://external.invalid" },
    { "x-permission-probe": "wrong" }, { "x-forwarded-host": "localhost:3012" }, { "x-forwarded-proto": "http" },
    { "content-length": "1" }, { "transfer-encoding": "chunked" }, { "sec-fetch-site": "cross-site" }]) {
    assert.equal(validPermissionPost({ ...good, ...change }, "test-nonce"), false);
  }
});

test("approval is pinned to exact identity/factor, content role and read-only scope", () => {
  const expected = { userId: "expected-user", factorId: "expected-factor" };
  const approved = { project: "onfxxtvfprjnqsxdmhkp", email: "hndstudy2026@gmail.com", ...expected, roleCode: "content_community_lead",
    approvalReference: "explicit-user-approval", runId: "permission-test-11111111-1111-4111-8111-111111111111", operations: ["permission_reads"] };
  assert.equal(validPermissionApproval(approved, expected), true);
  for (const change of [{ roleCode: "platform_owner" }, { userId: "other" }, { factorId: "retired" }, { project: "other" },
    { approvalReference: "" }, { operations: ["permission_reads", "role_writes"] }]) assert.equal(validPermissionApproval({ ...approved, ...change }, expected), false);
});

test("real local HTTP bridge GET is inert, POST is explicit, output safe and duplicate POST denied", async () => {
  let calls = 0, records = 0;
  const server = createPermissionBridge({ expected: "aal2", probe: async () => { calls++; return result("aal2"); }, record: () => { records++; } });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); assert.ok(address && typeof address !== "string");
  const url = `http://127.0.0.1:${address.port}`;
  const headers = { host: "localhost:3012" };
  // Node fetch can replace Host; use the HTTP client to exercise the guard at
  // an ephemeral test port without relaxing its fixed production-test Host.
  const send = (path: string, options: { method?: string; headers: Record<string, string>; body?: string }) => new Promise<Response>((resolve, reject) => {
    const request = httpRequest(url + path, { method: options.method ?? "GET", headers: { ...options.headers, ...(options.body === "" ? { "content-length": "0" } : {}) } }, response => {
      let text = "";
      response.on("data", chunk => { text += chunk.toString(); });
      response.on("end", () => resolve(new Response(text, { status: response.statusCode, headers: { "cache-control": String(response.headers["cache-control"] ?? "") } })));
    });
    request.on("error", reject); request.end(options.body);
  });
  try {
    const page = await send("/", { headers });
    assert.equal(page.status, 200); assert.equal(calls, 0);
    assert.match(page.headers.get("cache-control") ?? "", /no-store/);
    const nonce = (await page.text()).match(/'x-permission-probe':'([a-f0-9-]+)'/)?.[1]; assert.ok(nonce);
    assert.equal((await send("/probe", { method: "POST", headers, body: "" })).status, 403);
    assert.equal(calls, 0);
    const request = { method: "POST", headers: { ...headers, origin: "http://localhost:3012", "x-permission-probe": nonce }, body: "" };
    const answer = await send("/probe", request);
    assert.equal(answer.status, 200); assert.equal((await answer.json()).passed, true);
    assert.equal(calls, 1); assert.equal(records, 1);
    assert.equal((await send("/probe", request)).status, 403); assert.equal(calls, 1);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
