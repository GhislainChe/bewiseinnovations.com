import assert from "node:assert/strict";
import test from "node:test";
import { parseProjectRequest, parseBudget, parseService, parseStatusChange } from "./validation";
import { assertLocalBusinessRuntime } from "./runtime";
import { readBoundedJson, submitRequestHttp, SUBMISSION_FAILED } from "./submission";
const id = "10000000-0000-4000-8000-000000000001";
const valid = { serviceId: id, fullName: "Local Visitor", email: "Visitor@Example.invalid", whatsapp: "+237600000000", requirements: "A sufficiently detailed local test request.", preferredDeadline: null, consentVersion: "local-v1" };
const env = { NODE_ENV: "development", BUSINESS_BACKEND_ENABLED: "local", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65421", AUTH_TRUSTED_ORIGIN: "http://localhost:3000" };
const request = (body: unknown = valid, headers: Record<string, string> = {}) => new Request("http://localhost:3000/api/project-requests", { method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000", "content-type": "application/json", "idempotency-key": id, ...headers }, body: JSON.stringify(body) });
test("request normalization preserves unknown deadline and does not create a verified contact", () => {
  const parsed = parseProjectRequest(valid); assert.equal(parsed.email, "visitor@example.invalid"); assert.equal(parsed.budgetOptionId, null); assert.equal(parsed.preferredDeadline, null); assert.ok(!("verified" in parsed));
});
test("visitor cannot choose status, actor, attachments or a role", () => {
  for (const key of ["status", "actorId", "attachments", "role"]) assert.throws(() => parseProjectRequest({ ...valid, [key]: "forged" }));
});
test("malformed email, phone, IDs, control characters and short requirements rejected", () => {
  for (const change of [{ email: "one\r\nbcc:x@example.invalid" }, { whatsapp: "600000000" }, { serviceId: "bad" }, { fullName: "a\u0000b" }, { requirements: "short" }]) assert.throws(() => parseProjectRequest({ ...valid, ...change }));
});
test("real calendar dates, bounds and past deadlines checked", () => {
  for (const preferredDeadline of ["2027-02-30", "2000-01-01", "2100-01-01", "tomorrow"]) assert.throws(() => parseProjectRequest({ ...valid, preferredDeadline }, new Date("2026-10-31T00:00:00Z")));
  assert.equal(parseProjectRequest({ ...valid, preferredDeadline: "2026-11-01" }, new Date("2026-10-31T00:00:00Z")).preferredDeadline, "2026-11-01");
});
test("honeypot rejects bot payload", () => assert.throws(() => parseProjectRequest({ ...valid, website: "bot" })));
test("budget amounts are safe integer minor units with explicit currency", () => {
  const budget = { serviceId: id, label: "Estimate", currency: "USD", minMinor: 100, maxMinor: 200, unsure: false, active: true, sort: 0 };
  assert.equal(parseBudget(budget).minMinor, 100);
  for (const change of [{ minMinor: 1.5 }, { maxMinor: 99 }, { currency: null }, { unsure: true }, { maxMinor: Number.MAX_SAFE_INTEGER + 1 }]) assert.throws(() => parseBudget({ ...budget, ...change }));
  assert.equal(parseBudget({ ...budget, minMinor: null, maxMinor: null, currency: null, unsure: true }).unsure, true);
});
test("service cannot accept requests while draft and cannot advertise a startingPrice field", () => {
  const service = { slug: "web-development", title: "Web", description: "Description", status: "draft", acceptingRequests: false };
  assert.equal(parseService(service).id, null);
  assert.throws(() => parseService({ ...service, acceptingRequests: true })); assert.throws(() => parseService({ ...service, startingPrice: 1 }));
});
test("future quotation approval statuses remain unavailable", () => {
  assert.throws(() => parseStatusChange({ id, version: 1, status: "approved" })); assert.throws(() => parseStatusChange({ id, version: 1, status: "quoted" }));
});
test("local runtime fails closed for hosted target, deployment and absent opt-in", () => {
  assert.doesNotThrow(() => assertLocalBusinessRuntime(env));
  for (const override of [{ BUSINESS_BACKEND_ENABLED: "" }, { NEXT_PUBLIC_SUPABASE_URL: "https://onfxxtvfprjnqsxdmhkp.supabase.co" }, { VERCEL: "1" }]) assert.throws(() => assertLocalBusinessRuntime({ ...env, ...override }));
});
test("explicit same-origin anonymous POST returns reference only with no-store", async () => {
  let calls = 0; const r = await submitRequestHttp(request(), { env, ingress: async (body, key) => { calls++; assert.equal(body.email, "visitor@example.invalid"); assert.equal(key, id); return "BWR-" + "a".repeat(32); } });
  assert.equal(calls, 1); assert.equal(r.status, 202); assert.deepEqual(await r.json(), { reference: "BWR-" + "a".repeat(32) }); assert.match(r.headers.get("cache-control")!, /no-store/);
});
test("wrong, null and missing Origin plus conflicting forwarding never call ingress", async () => {
  const cases: Record<string, string>[] = [{ origin: "https://attacker.invalid" }, { origin: "null" }, { origin: "" }, { "x-forwarded-host": "attacker.invalid" }, { "x-forwarded-proto": "https" }];
  for (const h of cases) {
    let calls = 0; const r = await submitRequestHttp(request(valid, h), { env, ingress: async () => { calls++; return "unused"; } }); assert.equal(calls, 0); assert.equal(r.status, 400);
  }
});
test("missing idempotency key or malformed input never reaches ingress", async () => {
  for (const req of [request(valid, { "idempotency-key": "" }), request({ ...valid, email: "bad" })]) {
    const r = await submitRequestHttp(req, { env, ingress: async () => { throw new Error("must not call"); } }); assert.equal(r.status, 400);
  }
});
test("quota, duplicate conflict and storage failures have identical private-safe responses", async () => {
  for (const reason of ["quota", "duplicate conflict", "database unavailable"]) {
    const r = await submitRequestHttp(request(), { env, ingress: async () => { throw new Error(reason); } }); assert.deepEqual(await r.json(), { message: SUBMISSION_FAILED }); assert.equal(r.status, 400);
  }
});
test("stream byte limit does not trust Content-Length", async () => {
  const r = new Request("http://localhost", { method: "POST", headers: { "content-type": "application/json", "content-length": "1" }, body: " ".repeat(16385) }); await assert.rejects(readBoundedJson(r));
});
