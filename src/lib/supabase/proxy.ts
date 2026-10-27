import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { COOKIE_DIAGNOSTIC_HEADER, authCookieNameMatches, cookieDiagnostic, cookieDiagnosticsEnabled, isAuthCookieDeletion } from "@/lib/auth/cookie-diagnostics";

/** Refreshes tokens for routes matched by src/proxy.ts; it does not authorize. */
export async function updateSession(request: NextRequest) {
  // Overwrite any caller-supplied correlation header; it is never authorization.
  request.headers.delete(COOKIE_DIAGNOSTIC_HEADER);
  const id = crypto.randomUUID();
  const enabled = cookieDiagnosticsEnabled();
  if (enabled) request.headers.set(COOKIE_DIAGNOSTIC_HEADER, id);
  const phase = request.nextUrl.pathname === "/auth/sign-out/complete" ? "sign_out" : "auth_other";
  if (phase === "sign_out") cookieDiagnostic(id, phase,
    request.cookies.getAll().some(cookie => authCookieNameMatches(cookie.name)) ? "proxy_request_cookie_present" : "proxy_request_cookie_absent");
  let wrote = false;
  const { url, publishableKey } = getSupabaseConfig();
  let response = NextResponse.next({ request: { headers: request.headers } });
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, responseHeaders) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request: { headers: request.headers } });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        for (const cookie of cookiesToSet) {
          if (!authCookieNameMatches(cookie.name)) continue;
          wrote = true;
          cookieDiagnostic(id, phase, isAuthCookieDeletion({ name: cookie.name, ...cookie.options }) ? "proxy_cookie_deletion" : "proxy_cookie_write");
        }
        for (const [name, value] of Object.entries(responseHeaders ?? {})) {
          response.headers.set(name, value);
        }
      },
    },
  });

  await client.auth.getClaims();
  if (!wrote) cookieDiagnostic(id, phase, "proxy_no_cookie_write");
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
