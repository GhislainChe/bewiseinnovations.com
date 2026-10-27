import { createServer, type IncomingHttpHeaders } from "node:http";
import { randomUUID } from "node:crypto";

export const permissionBridgeOrigin = "http://localhost:3012";
export const contentCodes = ["content.read", "content.create", "content.update", "content.publish"];
export const deniedCodes = ["team.manage", "roles.assign", "settings.manage", "audit.read", "inquiries.read", "registrations.read", "waitlists.read"];
export type ProbeSummary = { aal: string; decisions: Record<string, boolean>; ownProfileCount: number; ownAssignmentCount: number; visibleAuditCount: number };

export function allowedPermissionRequest(url: URL, method: string) {
  const authPath = ["/auth/v1/user", "/auth/v1/.well-known/jwks.json"].includes(url.pathname);
  const restPath = /^\/rest\/v1\/(team_profiles|team_role_assignments|roles|permissions|role_permissions|audit_logs)$/.test(url.pathname);
  return url.origin === "https://onfxxtvfprjnqsxdmhkp.supabase.co" && !url.username && !url.password &&
    ["GET", "HEAD"].includes(method) && ((authPath && !url.search) || restPath);
}

export function validPermissionPost(headers: IncomingHttpHeaders, nonce: string) {
  return headers.host === "localhost:3012" && headers.origin === permissionBridgeOrigin &&
    headers["x-permission-probe"] === nonce && !headers["x-forwarded-host"] && !headers["x-forwarded-proto"] &&
    (!headers["sec-fetch-site"] || headers["sec-fetch-site"] === "same-origin") &&
    !headers["transfer-encoding"] && String(headers["content-length"] ?? "0") === "0";
}

/** Reconstruct output from fixed fields; never forward arbitrary callback data. */
export function permissionSummary(result: ProbeSummary, expected: "aal1" | "aal2") {
  const decisions = Object.fromEntries([...contentCodes, ...deniedCodes].map(code => [code, result.decisions[code] === true]));
  const ownProfileCount = result.ownProfileCount === 1 ? 1 : result.ownProfileCount === 0 ? 0 : -1;
  const ownAssignmentCount = result.ownAssignmentCount === 1 ? 1 : result.ownAssignmentCount === 0 ? 0 : -1;
  const visibleAuditCount = result.visibleAuditCount === 0 ? 0 : -1;
  const permitted = contentCodes.every(code => result.decisions[code] === (expected === "aal2"));
  const denied = deniedCodes.every(code => result.decisions[code] === false);
  const passed = result.aal === expected && permitted && denied && visibleAuditCount === 0 &&
    ownProfileCount === (expected === "aal2" ? 1 : 0) && ownAssignmentCount === (expected === "aal2" ? 1 : 0);
  return { passed, assuranceMatched: result.aal === expected, expected, decisions, ownProfileCount, ownAssignmentCount, visibleAuditCount };
}

/** Never listens automatically. Caller must bind 127.0.0.1, never a public interface. */
export function createPermissionBridge(options: {
  expected: "aal1" | "aal2";
  probe: (cookieHeader: string) => Promise<ProbeSummary>;
  record: (result: ReturnType<typeof permissionSummary>) => void;
}) {
  const nonce = randomUUID();
  let attempted = false;
  const server = createServer(async (request, response) => {
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("Referrer-Policy", "no-referrer");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Content-Security-Policy", `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'`);
    if (request.headers.host !== "localhost:3012") { response.writeHead(403); response.end(); return; }
    if (request.method === "GET" && request.url === "/") {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Private permission probe</title><h1>Private permission probe</h1><p>No password or code is entered here. Use only after the approved temporary binding.</p><button id="probe">Run one approved read-only permission probe</button><pre id="result" role="status"></pre><script nonce="${nonce}">document.getElementById('probe').onclick=async function(){this.disabled=true;try{const r=await fetch('/probe',{method:'POST',mode:'cors',credentials:'same-origin',referrerPolicy:'no-referrer',cache:'no-store',redirect:'error',headers:{'x-permission-probe':'${nonce}'},body:''});const data=await r.json();document.getElementById('result').textContent=JSON.stringify(data,null,2);}catch{document.getElementById('result').textContent='Probe unavailable. Stop; do not retry.';}};</script></html>`);
      return;
    }
    if (request.method !== "POST" || request.url !== "/probe" || !validPermissionPost(request.headers, nonce) || attempted) {
      response.writeHead(403); response.end(); return;
    }
    attempted = true;
    response.setHeader("Content-Type", "application/json");
    try {
      // Cookie header remains only in request/process memory; never record it.
      const result = permissionSummary(await options.probe(request.headers.cookie ?? ""), options.expected);
      options.record(result);
      response.end(JSON.stringify(result));
    } catch {
      response.writeHead(503); response.end(JSON.stringify({ message: "Probe unavailable. Stop; do not retry." }));
    }
  });
  server.requestTimeout = 15000;
  server.headersTimeout = 10000;
  return server;
}

export function validPermissionApproval(value: Record<string, unknown>, expected: { userId: string; factorId: string }) {
  return value.project === "onfxxtvfprjnqsxdmhkp" && value.userId === expected.userId &&
    value.email === "hndstudy2026@gmail.com" && value.factorId === expected.factorId &&
    value.roleCode === "content_community_lead" && typeof value.approvalReference === "string" &&
    value.approvalReference.trim().length > 0 && value.approvalReference.length <= 200 &&
    typeof value.runId === "string" && /^permission-test-[a-f0-9-]{36}$/.test(value.runId) &&
    Array.isArray(value.operations) && value.operations.length === 1 && value.operations[0] === "permission_reads";
}
