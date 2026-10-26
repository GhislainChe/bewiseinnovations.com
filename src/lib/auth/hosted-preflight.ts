import "server-only";
import { getSupabaseConfig } from "@/lib/supabase/env";
import { assertFlowSigningSecret } from "./flow";
import { createAuthFlowStore } from "./supabase-auth-store";
import { authOriginEnvironment, trustedAuthOrigin } from "./origin";

/** Startup only: no OTP, session, ticket registration or quota mutation. */
export async function hostedAuthPreflight() {
  let stage = "client_configuration_failed";
  try {
    const { url } = getSupabaseConfig();
    if (url !== "https://onfxxtvfprjnqsxdmhkp.supabase.co") return "project_mismatch";
    if (trustedAuthOrigin(authOriginEnvironment())?.origin !== "http://localhost:3000") return "origin_reason_configuration_invalid";
    if (process.env.AUTH_RECOVERY_MODE !== "disabled") return "recovery_not_disabled";
    stage = "signing_configuration_failed";
    assertFlowSigningSecret();
    stage = "store_configuration_failed";
    const store = createAuthFlowStore();
    stage = "store_check_failed";
    return await store.ready() ? "ready" : stage;
  } catch {
    return stage;
  }
}
