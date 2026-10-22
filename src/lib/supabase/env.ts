/** Read public configuration only when a Supabase operation is requested. */
export function getSupabaseConfig() {
  // Literal process.env references let Next.js inline these public values in browser code.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error(
      "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local.",
    );
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be a valid URL.");
  }

  if (
    !["https:", "http:"].includes(parsedUrl.protocol) ||
    (parsedUrl.protocol === "http:" && !["localhost", "127.0.0.1"].includes(parsedUrl.hostname))
  ) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS, except for a local Supabase instance.");
  }

  if (!publishableKey.startsWith("sb_publishable_") || publishableKey.includes("REPLACE_WITH")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY must be a Supabase publishable key.");
  }

  return { url, publishableKey };
}
