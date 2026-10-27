import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { validFormRequest, authRedirect } from "@/lib/auth/http";
import { clearFlowCookie } from "@/lib/auth/flow-cookie";
import { endCurrentSession, SIGN_OUT_FAILED, SIGN_OUT_SUCCEEDED } from "@/lib/auth/sign-out";
import { COOKIE_DIAGNOSTIC_HEADER, authCookieNameMatches, cookieDiagnostic, diagnosticId, isAuthCookieDeletion } from "@/lib/auth/cookie-diagnostics";

export async function POST(request: NextRequest) {
  const id = diagnosticId(request.headers.get(COOKIE_DIAGNOSTIC_HEADER));
  const incomingNames = request.cookies.getAll().filter(cookie => authCookieNameMatches(cookie.name)).map(cookie => cookie.name);
  const present = incomingNames.length > 0;
  const emit = (event: Parameters<typeof cookieDiagnostic>[2]) => cookieDiagnostic(id, "sign_out", event);
  const finish = (response: ReturnType<typeof authRedirect>) => {
    const deletions = response.cookies.getAll().filter(isAuthCookieDeletion);
    const complete = deletions.length > 0 && incomingNames.every(name => deletions.some(cookie => cookie.name === name));
    emit(complete ? "response_deletion_present" : "response_deletion_absent");
    return response;
  };
  emit(present ? "request_cookie_present" : "request_cookie_absent");
  if (!validFormRequest(request)) {
    emit("form_rejected");
    return finish(authRedirect(request, "/auth/error"));
  }
  try {
    const { client, apply } = createRouteClient(request);
    const ok = await endCurrentSession(client.auth);
    emit(!ok ? "sign_out_failed" : present ? "sign_out_succeeded" : "sign_out_missing_session");
    const response = authRedirect(request, "/auth/error", ok ? SIGN_OUT_SUCCEEDED : SIGN_OUT_FAILED);
    clearFlowCookie(response, request.nextUrl.protocol);
    return finish(apply(response));
  } catch {
    emit("sign_out_failed");
    const response = authRedirect(request, "/auth/error", SIGN_OUT_FAILED);
    clearFlowCookie(response, request.nextUrl.protocol);
    return finish(response);
  }
}
