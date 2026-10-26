import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { FLOW_COOKIE_NAME, type FlowType } from "@/lib/auth/flow";
import { clearFlowCookie } from "@/lib/auth/flow-cookie";
import { changePasswordAfterConfirmation } from "@/lib/auth/password-operation";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { authRedirect, validFormRequest } from "@/lib/auth/http";
import { passwordCompletionResponse } from "./password-response";

export async function completePassword(request: NextRequest, type: FlowType) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  const { client, apply } = createRouteClient(request);
  const form = await request.formData();
  let result;
  try {
    result = await changePasswordAfterConfirmation(
      client.auth, createAuthFlowStore(), request.cookies.get(FLOW_COOKIE_NAME)?.value, type,
      form.get("password"), form.get("confirmation"),
    );
  } catch {
    const response = authRedirect(request, "/auth/error");
    clearFlowCookie(response, request.nextUrl.protocol);
    return apply(response);
  }
  return apply(passwordCompletionResponse(request, type, result));
}
