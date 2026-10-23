/** Keep public recovery closed until the shared store is deployed and integration-tested. */
export function recoverySubmissionAvailable(runtime: string | undefined, hostname: string, supabaseUrl: string | undefined): boolean {
  if (runtime === "production" || !["localhost", "127.0.0.1"].includes(hostname)) return false;
  try {
    const target = new URL(supabaseUrl ?? "");
    return target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname);
  } catch {
    return false;
  }
}
