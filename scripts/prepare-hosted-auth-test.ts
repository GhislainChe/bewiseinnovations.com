import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { HOSTED_TEST_FILE, HOSTED_TEST_REF, HOSTED_TEST_URL, assertLocalHostedTestProcess } from "./hosted-auth-test-config";

try {
  assertLocalHostedTestProcess(process.env);
  if (readFileSync("supabase/.temp/project-ref", "utf8").trim() !== HOSTED_TEST_REF) throw new Error("Unexpected linked project.");
  execFileSync("git", ["check-ignore", "--quiet", HOSTED_TEST_FILE], { stdio: "ignore" });
  if (existsSync(HOSTED_TEST_FILE)) {
    console.log("Existing hosted test environment preserved; no values overwritten.");
  } else {
    const source = readFileSync(".env.local", "utf8");
    const url = source.match(/^NEXT_PUBLIC_SUPABASE_URL=(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2");
    const publicKey = source.match(/^NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=(.*)$/m)?.[1].trim().replace(/^(["'])(.*)\1$/, "$2") ?? "";
    if (url !== HOSTED_TEST_URL || !publicKey.startsWith("sb_publishable_")) throw new Error("Existing public configuration does not match the hosted project.");
    const contents = [
      "# PRIVATE: dedicated hosted readiness environment. Never share or commit.",
      `NEXT_PUBLIC_SUPABASE_URL=${HOSTED_TEST_URL}`,
      `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${publicKey}`,
      "# Enter the exact project's secret key directly in your editor; never in chat.",
      "SUPABASE_AUTH_STORE_SECRET_KEY=",
      `AUTH_FLOW_SIGNING_SECRET=${randomBytes(32).toString("hex")}`,
      "AUTH_RECOVERY_MODE=disabled",
      "AUTH_RECOVERY_TEST_ORIGIN=", "",
    ].join("\n");
    writeFileSync(HOSTED_TEST_FILE, contents, { flag: "wx", mode: 0o600 });
    if (process.platform === "win32") {
      const aclCommand = "$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=New-Object System.Security.AccessControl.FileSecurity; $acl.SetOwner($sid); $acl.SetAccessRuleProtection($true,$false); $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow'); $acl.AddAccessRule($rule); Set-Acl -LiteralPath '.env.hosted-auth-test.local' -AclObject $acl";
      execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", aclCommand], { stdio: "ignore", windowsHide: true, timeout: 10000 });
    }
    console.log("Private ignored hosted-test file prepared. A fresh random signing secret was generated without displaying it.");
    console.log("Enter only the hosted secret key in the dedicated file. Recovery remains disabled.");
  }
} catch {
  console.error("Preparation did not complete. Check project identity, Git ignore, file permissions, and the existing public configuration; no credentials were printed.");
  process.exitCode = 1;
}
