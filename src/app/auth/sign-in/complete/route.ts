import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { validFormRequest, authRedirect } from "@/lib/auth/http";
import { endCurrentSession, SIGN_OUT_FAILED } from "@/lib/auth/sign-out";
import { createAuthFlowStore } from "@/lib/auth/supabase-auth-store";
import { SIGN_IN_FAILED } from "@/lib/auth/sign-in";

export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  try {
    const { client, apply } = createRouteClient(request);
    try {
      const form = await request.formData(), email = form.get("email"), password = form.get("password");
      if (form.getAll("email").length !== 1 || form.getAll("password").length !== 1 || typeof email !== "string" || typeof password !== "string" || !email || email.length > 254 || !password || password.length > 1024) return apply(authRedirect(request, "/auth/error", SIGN_IN_FAILED));
      const limiter = createAuthFlowStore();
      if (!await limiter.ready() || !await limiter.consumeRecoveryBudget(`sign-in:${email.trim().toLowerCase()}`)) return apply(authRedirect(request, "/auth/error", SIGN_IN_FAILED));
      const result = await client.auth.signInWithPassword({ email, password });
      if (result.error) {
        const current = await client.auth.getUser();
        if (current.data.user && !await endCurrentSession(client.auth)) return apply(authRedirect(request, "/auth/error", SIGN_OUT_FAILED));
        return apply(authRedirect(request, "/auth/error", SIGN_IN_FAILED));
      }
      return apply(authRedirect(request, "/auth/mfa"));
    } catch { return apply(authRedirect(request, "/auth/error", SIGN_IN_FAILED)); }
  } catch { return authRedirect(request, "/auth/error", SIGN_IN_FAILED); }
}
