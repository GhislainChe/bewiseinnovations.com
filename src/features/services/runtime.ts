/** Local-only stage guard, applied before constructing any business client. */
export function assertLocalBusinessRuntime(env: Readonly<Record<string, string | undefined>> = process.env) {
  if (env.BUSINESS_BACKEND_ENABLED !== "local" || env.NEXT_PUBLIC_SUPABASE_URL !== "http://127.0.0.1:65421" || env.VERCEL || env.NETLIFY || env.CF_PAGES) {
    throw new Error("Local business backend is unavailable.");
  }
}
