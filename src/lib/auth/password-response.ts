import type { NextRequest } from "next/server";
import type { PasswordOutcome } from "./password-operation";
import type { FlowType } from "./flow";
import { clearFlowCookie } from "./flow-cookie";
import { authRedirect } from "./http";
import { SIGN_OUT_FAILED } from "./sign-out";

export function passwordCompletionResponse(request: NextRequest, type: FlowType, result: PasswordOutcome) {
  if (result.kind === "denied" || result.kind === "invalid") return authRedirect(request, "/auth/error");
  const path = type === "invite" ? "/auth/set-password" : "/auth/reset-password";
  if (result.kind === "validation") return authRedirect(request, path, result.message);
  const message = result.kind === "sign_out_failed" ? SIGN_OUT_FAILED
    : result.kind === "save_failed" ? "Password could not be saved. Request a new email link."
    : type === "invite" ? "Password saved. Your account is pending activation."
    : "Password reset. You may sign in when an approved sign-in page is available.";
  const response = authRedirect(request, "/auth/error", message);
  clearFlowCookie(response, request.nextUrl.protocol);
  return response;
}
