import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import type { FlowType } from "@/lib/auth/flow";
import { changePasswordAfterConfirmation } from "@/lib/auth/password-operation";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { authRedirect, validFormRequest } from "@/lib/auth/http";

export async function completePassword(request: NextRequest, type: FlowType) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  const { client, apply } = createRouteClient(request);
  const form = await request.formData();
  let result;
  try {
    result = await changePasswordAfterConfirmation(
      client.auth, createAuthFlowStore(), request.cookies.get("auth_flow")?.value, type,
      form.get("password"), form.get("confirmation"),
    );
  } catch {
    const response = authRedirect(request, "/auth/error");
    response.cookies.delete("auth_flow");
    return apply(response);
  }
  if (result.kind === "denied" || result.kind === "invalid") return apply(authRedirect(request, "/auth/error"));
  const passwordPath = type === "invite" ? "/auth/set-password" : "/auth/reset-password";
  if (result.kind === "validation") return apply(authRedirect(request, passwordPath, result.message));
  if (result.kind === "save_failed") {
    const response = authRedirect(request, "/auth/error", "Password could not be saved. Request a new email link.");
    response.cookies.delete("auth_flow");
    return apply(response);
  }
  const response = authRedirect(request, "/auth/error", type === "invite" ? "Password saved. Your account is pending activation." : "Password reset. You may sign in when an approved sign-in page is available.");
  response.cookies.delete("auth_flow");
  return apply(response);
}
