import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { authRedirect, validFormRequest } from "@/lib/auth/http";
import { recoverySubmissionAvailable } from "@/lib/auth/recovery-availability";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { requestRecoveryEmail } from "@/lib/auth/recovery-operation";

export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  if (!recoverySubmissionAvailable(process.env.NODE_ENV, request.nextUrl.hostname, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return authRedirect(request, "/auth/error", "Password recovery is temporarily unavailable.");
  }
  const { client, apply } = createRouteClient(request);
  const form = await request.formData();
  try {
    await requestRecoveryEmail(client.auth, createAuthFlowStore(), form.get("email"));
  } catch {
    // Generic response even when the server-only store is not configured.
  }
  return apply(authRedirect(request, "/auth/forgot-password?sent=1"));
}
