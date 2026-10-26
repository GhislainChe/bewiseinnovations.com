import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { validFormRequest, authRedirect } from "@/lib/auth/http";
import { clearFlowCookie } from "@/lib/auth/flow-cookie";
import { endCurrentSession, SIGN_OUT_FAILED, SIGN_OUT_SUCCEEDED } from "@/lib/auth/sign-out";

export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  try {
    const { client, apply } = createRouteClient(request);
    const ok = await endCurrentSession(client.auth);
    const response = authRedirect(request, "/auth/error", ok ? SIGN_OUT_SUCCEEDED : SIGN_OUT_FAILED);
    clearFlowCookie(response, request.nextUrl.protocol);
    return apply(response);
  } catch {
    const response = authRedirect(request, "/auth/error", SIGN_OUT_FAILED);
    clearFlowCookie(response, request.nextUrl.protocol);
    return response;
  }
}
