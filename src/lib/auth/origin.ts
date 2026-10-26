export type OriginEnvironment = { trustedOrigin?: string; runtime?: string; managed?: boolean };
type OriginRequest = { url: string; headers: Headers };

/** Configuration, never a value inferred from Host or forwarded headers. */
export function trustedAuthOrigin(config: OriginEnvironment): URL | null {
  try {
    const raw = config.trustedOrigin;
    if (!raw) return null;
    const url = new URL(raw);
    if (raw !== url.origin || url.username || url.password) return null;
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback && config.runtime === "development" && !config.managed)) return null;
    return url;
  } catch { return null; }
}

export function authOriginEnvironment(): OriginEnvironment {
  return { trustedOrigin: process.env.AUTH_TRUSTED_ORIGIN, runtime: process.env.NODE_ENV,
    managed: Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.CF_PAGES || process.env.CI) };
}

function category(host: string | null): "localhost" | "loopback_ip" | "other" | "absent" {
  if (!host) return "absent";
  if (host === "localhost" || host.startsWith("localhost:")) return "localhost";
  if (/^(127\.0\.0\.1|\[::1\])(?::\d+)?$/.test(host)) return "loopback_ip";
  return "other";
}

export function inspectAuthOrigin(request: OriginRequest, config = authOriginEnvironment()) {
  const expected = trustedAuthOrigin(config);
  const raw = request.headers.get("origin");
  const host = request.headers.get("host");
  let reason = "matched";
  if (!expected) reason = "configuration_invalid";
  else if (!raw) reason = "header_missing";
  else if (raw === "null") reason = "header_null";
  else if (raw !== expected.origin) reason = "header_mismatch";
  else if (host !== expected.host) reason = "host_mismatch";
  else if (request.headers.has("x-forwarded-host") && request.headers.get("x-forwarded-host") !== expected.host) reason = "forwarded_host_mismatch";
  else if (request.headers.has("x-forwarded-proto") && request.headers.get("x-forwarded-proto") !== expected.protocol.slice(0, -1)) reason = "forwarded_proto_mismatch";
  let requestUrlHost: string | null = null;
  try { requestUrlHost = new URL(request.url).host; } catch { /* Category only. */ }
  return {
    allowed: reason === "matched",
    // Only fixed categories leave this function; no headers/URLs are returned.
    labels: [raw ? "origin_header_present" : "origin_header_absent",
      `origin_expected_${expected ? category(expected.host) : "unconfigured"}`,
      `origin_request_host_${category(host)}`, `origin_request_url_${category(requestUrlHost)}`,
      `origin_reason_${reason}`],
  };
}
