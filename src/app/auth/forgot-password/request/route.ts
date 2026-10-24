import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { authRedirect, validFormRequest } from "@/lib/auth/http";
import { recoverySubmissionAvailable } from "@/lib/auth/recovery-availability";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { requestRecoveryEmail } from "@/lib/auth/recovery-operation";
import { getSupabaseConfig } from "@/lib/supabase/env";

export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  if (!recoverySubmissionAvailable({
    runtime: process.env.NODE_ENV,
    requestUrl: request.url,
    host: request.headers.get("host"),
    forwardedHost: request.headers.get("x-forwarded-host"),
    forwardedProto: request.headers.get("x-forwarded-proto"),
    supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    mode: process.env.AUTH_RECOVERY_MODE,
    testOrigin: process.env.AUTH_RECOVERY_TEST_ORIGIN,
    managedDeployment: Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.CF_PAGES || process.env.CI),
  })) {
    return authRedirect(request, "/auth/error", "Password recovery is temporarily unavailable.");
  }
  const form = await request.formData();
  const response = authRedirect(request, "/auth/forgot-password?sent=1");
  try {
    getSupabaseConfig();
    const { client, apply } = createRouteClient(request);
    await requestRecoveryEmail(client.auth, createAuthFlowStore(), form.get("email"));
    return apply(response);
  } catch {
    // Generic response even when the server-only store is not configured.
  }
  return response;
}
