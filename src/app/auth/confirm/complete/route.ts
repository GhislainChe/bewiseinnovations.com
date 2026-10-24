import { type NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { confirmationType } from "@/lib/auth/flow";
import { setFlowCookie } from "@/lib/auth/flow-cookie";
import { verifyConfirmation } from "@/lib/auth/confirmation";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { authRedirect, validFormRequest } from "@/lib/auth/http";

export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  const form = await request.formData();
  const type = confirmationType(form.get("type"));
  const token = form.get("token_hash");
  if (!type || typeof token !== "string" || token.length < 16 || token.length > 2048) {
    return authRedirect(request, "/auth/error");
  }
  const { client, apply } = createRouteClient(request);
  let ticket: string | null;
  try {
    ticket = await verifyConfirmation(client.auth, createAuthFlowStore(), type, token);
  } catch {
    // Do not disclose configuration, token, or provider details to the visitor.
    return apply(authRedirect(request, "/auth/error"));
  }
  if (!ticket) return apply(authRedirect(request, "/auth/error"));
  const response = authRedirect(request, type === "invite" ? "/auth/set-password" : "/auth/reset-password");
  setFlowCookie(response, ticket, request.nextUrl.protocol);
  return apply(response);
}
