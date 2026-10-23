import { NextResponse, type NextRequest } from "next/server";
import { sameOrigin } from "@/lib/auth/flow";

export function authRedirect(request: NextRequest, pathname: string, message?: string) {
  const url = new URL(pathname, request.url);
  if (message) url.searchParams.set("message", message);
  const response = NextResponse.redirect(url, { status: 303 });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export function validFormRequest(request: NextRequest): boolean {
  const length = Number(request.headers.get("content-length") ?? 0);
  return sameOrigin(request.url, request.headers.get("origin")) &&
    Number.isFinite(length) && length <= 4096 &&
    request.headers.get("content-type")?.startsWith("application/x-www-form-urlencoded") === true;
}
