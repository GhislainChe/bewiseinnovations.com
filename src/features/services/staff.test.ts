import test from "node:test";
import assert from "node:assert/strict";
import { staffBusinessHttp } from "./staff-http";
import { BusinessConflictError, type getServicesRepository } from "./server";
import { AuthorizationError } from "@/lib/auth/core";
import { budgetUpdate, nextStatuses, requestBudgetLabel, serviceUpdate, type StaffService } from "./staff-model";
import { parseBudget, parseService } from "./validation";

const env = { BUSINESS_BACKEND_ENABLED: "local", NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:65421", AUTH_TRUSTED_ORIGIN: "http://localhost:3022", NODE_ENV: "development" };
for (const [key,value] of Object.entries(env)) process.env[key] = value;
type Repo = Awaited<ReturnType<typeof getServicesRepository>>;
const id = "10000000-0000-4000-8000-000000000001";
function post(operation: string, input: unknown, origin = "http://localhost:3022") {
  return new Request("http://localhost:3022/internal/business-api", { method: "POST", headers: { host: "localhost:3022", origin, "content-type": "application/json" }, body: JSON.stringify({ operation, input }) });
}
test("staff HTTP rejects external, missing and null Origin before repository creation", async () => {
  for (const origin of ["https://evil.invalid", "", "null"]) {
    let called = false;
    const r = await staffBusinessHttp(post("service", {}, origin), async () => { called = true; throw new Error(); });
    assert.equal(r.status, 403); assert.equal(called, false);
  }
});
test("staff GET uses authorized repository and private response headers", async () => {
  const r = await staffBusinessHttp(new Request("http://localhost:3022/internal/business-api?view=catalog"), async () => ({ staffCatalog: async () => [{ title: "Authorized catalog" }] }) as unknown as Repo);
  assert.equal(r.status, 200); assert.match(r.headers.get("cache-control")!, /private, no-store/); assert.equal(r.headers.get("referrer-policy"), "no-referrer");
});
test("unauthorized request reads do not reveal private fields", async () => {
  const r = await staffBusinessHttp(new Request("http://localhost:3022/internal/business-api?view=requests"), async () => ({ listRequests: async () => { throw new AuthorizationError(); } }) as unknown as Repo);
  assert.equal(r.status, 403); assert.ok(!(await r.text()).includes("email"));
});
test("optimistic conflict returns 409 without database error details", async () => {
  const r = await staffBusinessHttp(post("service", {}), async () => ({ saveService: async () => { throw new BusinessConflictError("sensitive"); } }) as unknown as Repo);
  assert.equal(r.status, 409); assert.ok(!(await r.text()).includes("sensitive"));
});
test("fixed operations reject role commands and oversized JSON before mutation", async () => {
  let mutations = 0;
  const repo = async () => ({ saveService: async () => { mutations++; } }) as unknown as Repo;
  assert.equal((await staffBusinessHttp(post("assign_role", { role: "platform_owner" }), repo)).status, 400);
  assert.equal((await staffBusinessHttp(post("service", { description: "x".repeat(17000) }), repo)).status, 400);
  assert.equal(mutations, 0);
});
test("reference search passes exact reference through authorized caller repository", async () => {
  const ref = "BWR-" + "a".repeat(32);
  const r = await staffBusinessHttp(new Request("http://localhost:3022/internal/business-api?view=requests&reference=" + ref), async () => ({ listRequests: async (limit: number, reference: string) => { assert.equal(limit, 100); assert.equal(reference, ref); return []; } }) as unknown as Repo);
  assert.equal(r.status, 200);
});
test("request detail returns protected metadata without issuing a download on GET", async () => {
  const r = await staffBusinessHttp(new Request("http://localhost:3022/internal/business-api?view=detail&id=" + id), async () => ({ getRequest: async () => ({ id }), attachments: async () => [{ scan_status: "quarantined" }], attachmentDownload: async () => { throw new Error("must not run"); } }) as unknown as Repo);
  assert.deepEqual(await r.json(), { detail: { id }, attachments: [{ scan_status: "quarantined" }] });
});
test("form mapping preserves exact version and uses whole XAF amounts", () => {
  const f = new FormData(); for (const [k,v] of Object.entries({ title: "Website", description: "Approved description", status: "published", accepting: "on" })) f.set(k,v);
  const s = { id, version: 8, slug: "website", status: "published" } as StaffService;
  assert.equal(parseService(serviceUpdate(s,f)).version, 8);
  const b = new FormData(); for (const [k,v] of Object.entries({ label: "Client estimate", min: "50000", max: "100000", sort: "10", active: "on" })) b.set(k,v);
  const parsed = parseBudget(budgetUpdate(id,null,b)); assert.equal(parsed.currency,"XAF"); assert.equal(parsed.minMinor,50000);
  b.set("min","1.5"); assert.throws(() => parseBudget(budgetUpdate(id,null,b)));
  b.set("unsure","on"); assert.equal(parseBudget(budgetUpdate(id,null,b)).minMinor,null);
  assert.match(requestBudgetLabel({label:"Submitted estimate",currency:"XAF",minMinor:50000,maxMinor:100000}), /50,000.*100,000/);
  assert.equal(requestBudgetLabel({label:"Not sure yet",currency:"XAF",unsure:true}),"Not sure yet");
});
test("status controls expose only supported transitions and never approval or quotation", () => {
  assert.deepEqual(nextStatuses("received"), ["triaging","declined","cancelled"]);
  for (const status of ["closed","cancelled","declined","unknown"]) assert.deepEqual(nextStatuses(status),[]);
  assert.ok(!nextStatuses("discussing").includes("approved"));
});
