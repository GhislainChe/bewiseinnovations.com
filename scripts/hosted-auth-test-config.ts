import { lstatSync } from "node:fs";
import { execFileSync } from "node:child_process";

export const HOSTED_TEST_FILE = ".env.hosted-auth-test.local";
export const HOSTED_TEST_URL = "https://onfxxtvfprjnqsxdmhkp.supabase.co";
export const HOSTED_TEST_REF = "onfxxtvfprjnqsxdmhkp";
const names = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "SUPABASE_AUTH_STORE_SECRET_KEY", "AUTH_FLOW_SIGNING_SECRET", "AUTH_RECOVERY_MODE", "AUTH_RECOVERY_TEST_ORIGIN"];

/** Restricted dotenv syntax: no evaluation, expansion, duplicates, or ambient fallback. */
export function parseHostedTestEnvironment(source: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    const match = line.match(/^([A-Z_]+)=(.*)$/);
    if (!match || !names.includes(match[1]) || Object.hasOwn(values, match[1])) throw new Error("Invalid hosted-test environment file format.");
    values[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return values;
}

export function validateHostedTestEnvironment(values: Record<string, string>): string[] {
  const issues: string[] = [];
  if (values.NEXT_PUBLIC_SUPABASE_URL !== HOSTED_TEST_URL) issues.push("Expected hosted project URL is required.");
  if (!/^sb_publishable_[A-Za-z0-9_-]{20,}$/.test(values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "") || values.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.includes("REPLACE_WITH")) issues.push("Hosted publishable key is required.");
  const secret = values.SUPABASE_AUTH_STORE_SECRET_KEY ?? "";
  let validSecret = /^sb_secret_[A-Za-z0-9_-]{20,}$/.test(secret) && !secret.includes("REPLACE_WITH");
  if (!validSecret && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(secret)) {
    try {
      const payload = JSON.parse(Buffer.from(secret.split(".")[1], "base64url").toString("utf8"));
      validSecret = payload.role === "service_role" && payload.ref === HOSTED_TEST_REF;
    } catch { /* Invalid legacy format. The gateway still verifies any accepted key. */ }
  }
  if (!validSecret) issues.push("Same-project hosted secret/service-role key must be entered privately.");
  if (!/^[a-f0-9]{64}$/.test(values.AUTH_FLOW_SIGNING_SECRET ?? "")) issues.push("A generated 32-byte hexadecimal signing secret is required.");
  if (values.AUTH_RECOVERY_MODE !== "disabled" || values.AUTH_RECOVERY_TEST_ORIGIN !== "") issues.push("Recovery must remain disabled for credential-readiness preparation.");
  return issues;
}

export function assertLocalHostedTestProcess(env: Readonly<Record<string, string | undefined>>) {
  if (env.NODE_ENV === "production" || env.VERCEL || env.NETLIFY || env.CF_PAGES || env.CI) throw new Error("Hosted credential checks are restricted to a local non-production process.");
}

export function assertHostedTestFilePrivacy() {
  execFileSync("git", ["check-ignore", "--quiet", HOSTED_TEST_FILE], { stdio:"ignore" });
  const info = lstatSync(HOSTED_TEST_FILE);
  if (!info.isFile() || info.isSymbolicLink()) throw new Error("Expected a regular private test file.");
  if (process.platform === "win32") {
    const command = "$sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; $acl=Get-Acl -LiteralPath '.env.hosted-auth-test.local'; $rules=@($acl.Access); $valid=$acl.AreAccessRulesProtected -and ($rules.Count -eq 1) -and ($rules[0].IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -eq $sid.Value) -and ($rules[0].AccessControlType -eq 'Allow'); Write-Output $valid";
    const result = execFileSync("powershell.exe", ["-NoProfile","-NonInteractive","-Command",command], {encoding:"utf8",windowsHide:true,timeout:10000,stdio:["ignore","pipe","ignore"]});
    if (result.trim() !== "True") throw new Error("Hosted test file permissions require review.");
  } else if ((info.mode & 0o077) !== 0 || (process.getuid && info.uid !== process.getuid())) {
    throw new Error("Hosted test file permissions require review.");
  }
}
