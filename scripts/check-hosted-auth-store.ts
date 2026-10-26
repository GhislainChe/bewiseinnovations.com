// Run with the server-only export condition; no HTTP endpoint is added.
import { readFileSync } from "node:fs";
import { createAuthFlowStore } from "../src/lib/auth/supabase-auth-store";
import { HOSTED_TEST_FILE, HOSTED_TEST_REF, parseHostedTestEnvironment, validateHostedTestEnvironment, assertLocalHostedTestProcess, assertHostedTestFilePrivacy } from "./hosted-auth-test-config";

async function main() {
  assertLocalHostedTestProcess(process.env);
  if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== HOSTED_TEST_REF) throw new Error("Unexpected linked project.");
  assertHostedTestFilePrivacy();
  const values = parseHostedTestEnvironment(readFileSync(HOSTED_TEST_FILE, "utf8"));
  const issues = validateHostedTestEnvironment(values);
  if (issues.length) {
    console.log("Readiness RPC NOT executed: dedicated test configuration is incomplete.");
    for (const issue of issues) console.log(issue);
    process.exitCode = 2;
    return;
  }
  // Only explicit file values are used; inherited local credentials cannot win.
  for (const [key, value] of Object.entries(values)) process.env[key] = value;
  const ready = await createAuthFlowStore().ready();
  console.log(ready ? "Hosted Auth-store readiness PASSED for the approved project." : "Hosted Auth-store readiness FAILED; stop before any account or email test.");
  if (!ready) process.exitCode = 1;
}

// This executable performs one SELECT-only RPC, never registration/redemption/quota writes.
const watchdog = setTimeout(() => { console.error("Readiness check exceeded 20 seconds; stopped."); process.exit(1); }, 20000);
void main().catch(() => {
  console.error("Readiness check stopped safely. Verify the dedicated file, target, and credential locally; no sensitive error payload printed.");
  process.exitCode = 1;
}).finally(() => { clearTimeout(watchdog); });
