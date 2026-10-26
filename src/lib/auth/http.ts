import { NextResponse, type NextRequest } from "next/server";
import { authOriginEnvironment, inspectAuthOrigin, trustedAuthOrigin, type OriginEnvironment } from "./origin";

export function authRedirect(request: NextRequest, pathname: string, message?: string) {
  const origin = trustedAuthOrigin(authOriginEnvironment());
  // Never derive an auth redirect from an untrusted request host.
  if (!origin) {
    if (request.headers.get("x-auth-form") === "1") return NextResponse.json({ destination: "/auth/error" }, { headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
    return new NextResponse(null, { status: 303, headers: { Location: "/auth/error", "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" } });
  }
  const url = new URL(pathname, origin);
  if (url.origin !== origin.origin) throw new Error("Invalid authentication redirect.");
  if (url.hash || [...url.searchParams.keys()].some(key => key !== "message" && key !== "sent")) throw new Error("Invalid authentication redirect.");
  if (message) url.searchParams.set("message", message);
  const response = request.headers.get("x-auth-form") === "1"
    ? NextResponse.json({ destination: url.pathname + url.search })
    : NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function validFormRequest(request: NextRequest, config?: OriginEnvironment): boolean {
  return formRequestFailure(request, config) === null;
}

/** Fixed reason codes only; never return header values or URLs. */
export function formRequestFailure(request: NextRequest, config?: OriginEnvironment): "origin_rejected" | "body_size_rejected" | "content_type_rejected" | null {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (!inspectAuthOrigin(request, config).allowed) return "origin_rejected";
  if (!Number.isFinite(length) || length > 4096) return "body_size_rejected";
  if (!request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded")) return "content_type_rejected";
  return null;
}
