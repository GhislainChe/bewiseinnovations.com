const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

if (!url || !key?.startsWith("sb_publishable_") || key.includes("REPLACE_WITH")) {
  console.error("Supabase connectivity check: configure the project URL and publishable key in .env.local first.");
  process.exitCode = 1;
} else {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" || parsed.hostname !== "onfxxtvfprjnqsxdmhkp.supabase.co") {
      throw new Error("The configured URL does not match the existing remote Supabase project.");
    }

    const endpoint = new URL("/auth/v1/health", parsed);
    // Supabase's documented read-only health request. Never send the
    // publishable key as a Bearer token: it is not a JWT.
    const healthResponse = await fetch(endpoint, {
      headers: { apikey: key, Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    // A negative control proves the health route actually enforces API keys.
    // Inspect only response statuses; never print keys or response bodies.
    const invalidKeyResponse = await fetch(endpoint, {
      headers: { apikey: "sb_publishable_intentionally_invalid", Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });

    if (healthResponse.ok && invalidKeyResponse.status === 401) {
      console.log("Supabase connectivity check passed: the project accepted the configured publishable key.");
    } else if (healthResponse.status === 401 && invalidKeyResponse.status === 401) {
      console.error(
        "Supabase API gateway rejected the configured publishable key (HTTP 401). Recheck it in Dashboard > Settings > API Keys.",
      );
      process.exitCode = 1;
    } else if (healthResponse.ok && invalidKeyResponse.ok) {
      console.error("Supabase health endpoint is publicly accessible; it cannot verify the publishable key.");
      process.exitCode = 1;
    } else {
      console.error(
        `Supabase connectivity check is inconclusive (configured key HTTP ${healthResponse.status}; invalid control HTTP ${invalidKeyResponse.status}).`,
      );
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`Supabase connectivity check failed: ${error instanceof Error ? error.message : "unknown error"}`);
    process.exitCode = 1;
  }
}
