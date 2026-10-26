import { type NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { confirmationInput } from "@/lib/auth/confirmation-input";
import { setFlowCookie } from "@/lib/auth/flow-cookie";
import { verifyConfirmation } from "@/lib/auth/confirmation";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { authRedirect, formRequestFailure } from "@/lib/auth/http";
import { inspectAuthOrigin } from "@/lib/auth/origin";

export async function POST(request: NextRequest) {
  // Fixed labels only: no request URL, identity, token, cookie or raw error.
  const report = (event: string) => console.info("auth_confirmation", event);
  report("form_received");
  for (const label of inspectAuthOrigin(request).labels) report(label);
  const formFailure = formRequestFailure(request);
  if (formFailure) {
    report(formFailure);
    return authRedirect(request, "/auth/error");
  }
  let form;
  try { form = await request.formData(); } catch {
    report("form_parse_failed");
    return authRedirect(request, "/auth/error");
  }
  if (form.getAll("type").length !== 1 || form.getAll("token_hash").length !== 1) {
    report("input_field_count_invalid");
    report("input_rejected");
    return authRedirect(request, "/auth/error");
  }
  const input = confirmationInput(form.get("token_hash"), form.get("type"));
  if (!input.ok) {
    report(input.reason);
    report("input_rejected");
    return authRedirect(request, "/auth/error");
  }
  const { token, type } = input;
  let routeClient;
  try { routeClient = createRouteClient(request); } catch {
    report("client_configuration_failed");
    return authRedirect(request, "/auth/error");
  }
  const { client, apply } = routeClient;
  let ticket: string | null;
  try {
    let store;
    try { store = createAuthFlowStore(); } catch {
      report("store_configuration_failed");
      return apply(authRedirect(request, "/auth/error"));
    }
    ticket = await verifyConfirmation(client.auth, store, type, token, report);
  } catch {
    // Do not disclose configuration, token, or provider details to the visitor.
    return apply(authRedirect(request, "/auth/error"));
  }
  if (!ticket) return apply(authRedirect(request, "/auth/error"));
  const response = authRedirect(request, type === "invite" ? "/auth/set-password" : "/auth/reset-password");
  setFlowCookie(response, ticket, request.nextUrl.protocol);
  return apply(response);
}
