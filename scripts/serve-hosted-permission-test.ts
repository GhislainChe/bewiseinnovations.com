// Explicitly started private process, not a Next.js route or hosted write runner.
import "server-only";
import { readFileSync, writeFileSync } from "node:fs";
import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import { allowedPermissionRequest, createPermissionBridge, validPermissionApproval } from "./permission-session-bridge";
import { probeContentTestPermissions } from "./permission-test-harness";
import { getCurrentTeamMember } from "../src/lib/auth/core";
import { createSupabaseAuthGateway } from "../src/lib/auth/supabase-gateway";
import { HOSTED_TEST_FILE, HOSTED_TEST_REF, HOSTED_TEST_URL, parseHostedTestEnvironment, assertLocalHostedTestProcess, assertHostedTestFilePrivacy } from "./hosted-auth-test-config";

const safeError = console.error.bind(console);
console.error = () => {}; // Never forward SDK transport errors or request objects.
console.warn = () => {};
try {
  assertLocalHostedTestProcess(process.env);
  assertHostedTestFilePrivacy();
  if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== HOSTED_TEST_REF) throw new Error();
  const expected = process.argv[2];
  if (process.argv.length !== 3 || (expected !== "aal1" && expected !== "aal2")) throw new Error();
  const directory = ".supabase/hosted-mfa-stage-2e9/";
  const original = JSON.parse(readFileSync(directory + "invitation-result.json", "utf8"));
  const replacement = JSON.parse(readFileSync(directory + "replacement-factor-verification.json", "utf8"));
  // This operator-created record is intentionally absent until explicit execution approval.
  const approval = JSON.parse(readFileSync(directory + "content-permission-run.json", "utf8"));
  if (original.project !== HOSTED_TEST_REF || original.email !== "hndstudy2026@gmail.com" ||
    replacement.userId !== original.accountUuid || !replacement.replacementVerified || !replacement.retiredFactorAbsent ||
    !validPermissionApproval(approval, { userId: original.accountUuid, factorId: replacement.replacementFactorId })) throw new Error();
  const publicEnvironment = parseHostedTestEnvironment(readFileSync(HOSTED_TEST_FILE, "utf8"));
  const apiKey = publicEnvironment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (publicEnvironment.NEXT_PUBLIC_SUPABASE_URL !== HOSTED_TEST_URL || !/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(apiKey ?? "")) throw new Error();
  // Only public key is used. No administrative Supabase client is constructed.
  const server = createPermissionBridge({
    expected,
    async probe(cookieHeader) {
      const client = createServerClient(HOSTED_TEST_URL, apiKey, {
        cookies: { getAll: () => parseCookieHeader(cookieHeader).map(cookie => ({ name: cookie.name, value: cookie.value ?? "" })), setAll: () => {} },
        global: { fetch: async (input, init) => {
          const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
          const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
          if (!allowedPermissionRequest(url, method)) throw new Error("Read-only probe unavailable.");
          try { return await fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) }); }
          catch { throw new Error("Read-only probe unavailable."); }
        } },
      });
      const factors = await client.auth.mfa.listFactors();
      if (factors.error || factors.data.totp.length !== 1 || factors.data.totp[0].id !== replacement.replacementFactorId || factors.data.totp[0].status !== "verified") throw new Error("Pinned factor unavailable.");
      if (expected === "aal2") {
        const member = await getCurrentTeamMember(createSupabaseAuthGateway(client));
        if (!member || member.id !== original.accountUuid || member.roleCodes.length !== 1 || member.roleCodes[0] !== "content_community_lead" ||
          JSON.stringify([...member.permissionCodes].sort()) !== JSON.stringify(["content.create", "content.publish", "content.read", "content.update"])) throw new Error("Unexpected membership.");
      }
      // Expired sessions fail closed: POST refresh, logout and mutations are blocked.
      return probeContentTestPermissions(client, original.accountUuid);
    },
    record(result) {
      writeFileSync(`${directory}${approval.runId}-${expected}-permission-result.json`, JSON.stringify({ observedAt: new Date().toISOString(), runId: approval.runId, ...result }, null, 2) + "\n", { flag: "wx" });
      console.log(result.passed ? "permission_probe passed" : "permission_probe unexpected_result");
    },
  });
  server.listen(3012, "127.0.0.1", () => console.log("Private permission probe ready at http://localhost:3012; no probe executed."));
  server.on("error", () => { safeError("Private permission probe could not bind; no probe executed."); process.exitCode = 1; });
  const timer = setTimeout(() => server.close(), 15 * 60 * 1000); timer.unref();
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => server.close(() => process.exit()));
} catch {
  safeError("Private permission probe refused startup: verify explicit approval, exact identity/factor and public configuration. No probe executed.");
  process.exitCode = 1;
}
