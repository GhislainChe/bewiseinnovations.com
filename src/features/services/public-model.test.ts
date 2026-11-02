import test from "node:test";
import assert from "node:assert/strict";
import { blankRequest, budgetLabel, createRequestSender, decodeCatalog, requestErrors, requestPayload } from "./public-model";
const id = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002";
const catalog = decodeCatalog([{ id, title: "Backend service", slug: "service", description: "Actual backend description", accepting_requests: true, service_budget_options: [{ id, label: "Backend choice", sort_order: 0, currency: null, min_minor: null, max_minor: null, is_unsure: true }] }]);
const fields = { ...blankRequest, serviceId: id, budgetOptionId: id, fullName: "Test Visitor", email: "visitor@example.invalid", whatsapp: "+237600000000", requirements: "A sufficiently detailed project description.", consent: true };
test("catalog retains backend labels, strips extra fields and orders budget options", () => {
  assert.equal(catalog[0].title, "Backend service"); assert.equal(catalog[0].service_budget_options[0].label, "Backend choice");
  assert.throws(() => decodeCatalog({ services: [] })); assert.throws(() => decodeCatalog([{ ...catalog[0], id: "bad" }]));
});
test("service selection requires that service's budget; paused service is not submittable", () => {
  assert.ok(requestErrors({ ...fields, budgetOptionId: other }, catalog).budgetOptionId);
  assert.ok(requestErrors(fields, [{ ...catalog[0], accepting_requests: false }]).serviceId);
  assert.deepEqual(requestErrors(fields, catalog), {});
});
test("service without options permits a null budget; unsure deadline is null", () => {
  assert.deepEqual(requestErrors({ ...fields, budgetOptionId: "" }, [{ ...catalog[0], service_budget_options: [] }]), {});
  assert.equal(requestPayload({ ...fields, deadlineKnown: false, preferredDeadline: "2000-01-01" }).preferredDeadline, null);
});
test("validation provides field errors including consent and known-date requirements", () => {
  const e = requestErrors({ ...blankRequest, deadlineKnown: true }, catalog);
  for (const k of ["fullName", "email", "whatsapp", "serviceId", "requirements", "consent", "preferredDeadline"] as const) assert.ok(e[k]);
});
test("multibyte input is checked against the backend byte limit before sending", () => {
  assert.ok(requestErrors({ ...fields, requirements: "界".repeat(6000) }, catalog).requirements);
});
test("double submit is blocked while pending and after success", async () => {
  let count = 0; let resolve!: (r: Response) => void;
  const sender = createRequestSender(async () => { count++; return new Promise(r => { resolve = r; }); }, () => id);
  const first = sender(requestPayload(fields)); assert.deepEqual(await sender(requestPayload(fields)), { kind: "busy" });
  resolve(Response.json({ reference: "BWR-" + "a".repeat(32) })); assert.equal((await first).kind, "success");
  assert.deepEqual(await sender(requestPayload(fields)), { kind: "busy" }); assert.equal(count, 1);
});
test("lost response retry retains exact key/body and never retries automatically", async () => {
  const calls: RequestInit[] = []; let keys = 0;
  const sender = createRequestSender(async (_url, options) => { calls.push(options!); if (calls.length === 1) throw new Error("lost response"); return Response.json({ reference: "BWR-" + "a".repeat(32) }); }, () => { keys++; return id; });
  assert.deepEqual(await sender(requestPayload(fields)), { kind: "uncertain" }); assert.equal(calls.length, 1);
  assert.deepEqual(await sender(requestPayload({ ...fields, fullName: "Changed" })), { kind: "changed" }); assert.equal(calls.length, 1);
  assert.equal((await sender(requestPayload(fields))).kind, "success"); assert.equal(keys, 1);
  assert.equal(calls[0].body, calls[1].body); assert.deepEqual(calls[0].headers, calls[1].headers); assert.equal(calls[0].credentials, "omit");
});
test("generic failure and invalid receipt never show success", async () => {
  for (const response of [new Response("error", { status: 400 }), Response.json({ reference: "wrong" })]) {
    const sender = createRequestSender(async () => response, () => id); assert.deepEqual(await sender(requestPayload(fields)), { kind: "uncertain" });
  }
});

test("budget ranges format actual minor units and currency; unsure stays a label", () => {
 const b=catalog[0].service_budget_options[0];
 assert.equal(budgetLabel(b), "Backend choice");
 assert.match(budgetLabel({...b,is_unsure:false,currency:"USD",min_minor:10000,max_minor:20000}), /USD.*100.*USD.*200/);
 assert.match(budgetLabel({...b,is_unsure:false,currency:"XAF",min_minor:10000,max_minor:null}), /10,000.*or more/);
});
