/** Server callers only. No cookie values, provider messages, or request URLs enter events. */
export const COOKIE_DIAGNOSTIC_HEADER = "x-auth-cookie-diagnostic-id";
const idPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export const cookieDiagnosticEvents = [
  "request_cookie_present", "request_cookie_absent", "form_rejected",
  "proxy_request_cookie_present", "proxy_request_cookie_absent",
  "sign_out_succeeded", "sign_out_failed", "sign_out_missing_session",
  "response_deletion_present", "response_deletion_absent",
  "proxy_cookie_write", "proxy_cookie_deletion", "proxy_no_cookie_write",
] as const;
export type CookieDiagnosticEvent = typeof cookieDiagnosticEvents[number];
type Environment = Readonly<Record<string, string | undefined>>;

export function cookieDiagnosticsEnabled(env: Environment = process.env) {
  return env.AUTH_COOKIE_DIAGNOSTICS === "1" && env.NODE_ENV === "development" &&
    env.AUTH_TRUSTED_ORIGIN === "http://localhost:3000" &&
    ![env.VERCEL, env.NETLIFY, env.CF_PAGES, env.CI].some(Boolean);
}

export function diagnosticId(value: string | null) {
  return value && idPattern.test(value) ? value : crypto.randomUUID();
}

/** Only the configured project's exact base cookie and numeric chunks count. */
export function authCookieNameMatches(name: string, url = process.env.NEXT_PUBLIC_SUPABASE_URL) {
  try {
    const base = `sb-${new URL(url ?? "").hostname.split(".")[0]}-auth-token`;
    return name === base || (name.startsWith(`${base}.`) && /^\d+$/.test(name.slice(base.length + 1)));
  } catch { return false; }
}

export type CookieMetadata = { name: string; path?: string; domain?: string; maxAge?: number; expires?: Date | number };
export function isAuthCookieDeletion(cookie: CookieMetadata) {
  return authCookieNameMatches(cookie.name) && cookie.path === "/" && !cookie.domain &&
    (cookie.maxAge === 0 || (cookie.maxAge === undefined && cookie.expires instanceof Date && cookie.expires.getTime() <= Date.now()));
}

export function safeCookieDiagnosticLine(line: string): string | null {
  const match = /^auth_cookie ([a-f0-9-]{36}) (sign_out|auth_other) ([a-z_]+)$/.exec(line);
  return match && match[0] === line && idPattern.test(match[1]) && cookieDiagnosticEvents.includes(match[3] as CookieDiagnosticEvent) ? line : null;
}

export function cookieDiagnostic(id: string, phase: "sign_out" | "auth_other", event: CookieDiagnosticEvent) {
  if (!cookieDiagnosticsEnabled()) return;
  const line = safeCookieDiagnosticLine(`auth_cookie ${id} ${phase} ${event}`);
  if (line) console.info(line);
}
