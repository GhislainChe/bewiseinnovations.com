import { readFileSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { HOSTED_TEST_FILE, HOSTED_TEST_REF, parseHostedTestEnvironment, validateHostedTestEnvironment, assertLocalHostedTestProcess, assertHostedTestFilePrivacy } from "./hosted-auth-test-config";
import { safeAuthDiagnosticLine } from "./auth-diagnostic-output";

try {
  assertLocalHostedTestProcess(process.env);
  if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== HOSTED_TEST_REF) throw new Error("Unexpected linked project.");
  assertHostedTestFilePrivacy();
  if (process.argv.length !== 2) throw new Error("Launcher does not accept bind/port overrides.");
  const values = parseHostedTestEnvironment(readFileSync(HOSTED_TEST_FILE, "utf8"));
  if (validateHostedTestEnvironment(values).length) throw new Error("Hosted test configuration incomplete.");
  // Dedicated localhost launcher, not a deployment command. No CLI secrets.
  const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", "--port", "3000"], {
    env: { ...process.env, ...values, NODE_ENV: "development", AUTH_LOCAL_PREFLIGHT: "1", AUTH_TRUSTED_ORIGIN: "http://localhost:3000" }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [child.stdout, child.stderr]) {
    let pending = "";
    stream?.on("data", (chunk: Buffer) => {
      pending += chunk.toString("utf8");
      let newline;
      while ((newline = pending.indexOf("\n")) !== -1) {
        const safe = safeAuthDiagnosticLine(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
        if (safe) console.log(safe);
      }
      // Bound memory even if a child emits a large token-bearing line.
      if (pending.length > 8192) pending = "[discarded oversized line]";
    });
  }
  console.log("Local hosted-test server starting at http://localhost:3000, bound only to 127.0.0.1. Request logs suppressed; recovery disabled.");
  console.log("For safe diagnostics in VS Code, open an integrated terminal and run: npm run auth:hosted:logs");
  child.on("error", () => { console.error("Local test server failed to start."); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 0; });
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => {
    if (process.platform === "win32" && child.pid) {
      // Stop only this launcher's child tree, including the Next.js dev worker.
      try { execFileSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio:"ignore", windowsHide:true }); } catch { /* Already exited. */ }
    } else child.kill(signal);
  });
} catch {
  console.error("Local launcher refused to start. Verify the dedicated test configuration; no credentials printed.");
  process.exitCode = 1;
}
