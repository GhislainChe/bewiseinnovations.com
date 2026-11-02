export async function register() {
  // Keep the Node-only import inside a statically recognizable runtime branch.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    if (process.env.NODE_ENV !== "development" || process.env.AUTH_LOCAL_PREFLIGHT !== "1" ||
      process.env.VERCEL || process.env.NETLIFY || process.env.CF_PAGES || process.env.CI) return;
    const { hostedAuthPreflight } = await import("./lib/auth/hosted-preflight");
    console.info("auth_preflight", await hostedAuthPreflight());
  }
}
