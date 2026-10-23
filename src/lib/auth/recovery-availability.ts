/** No shared request store is configured yet. Fail closed on public deployments. */
export function recoverySubmissionAvailable(runtime: string | undefined, hostname: string, supabaseUrl: string | undefined): boolean {
  if (runtime === "production" || !["localhost", "127.0.0.1"].includes(hostname)) return false;
  try {
    const target = new URL(supabaseUrl ?? "");
    return target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname);
  } catch {
    return false;
  }
}
