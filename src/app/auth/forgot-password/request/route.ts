import type { NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { authRedirect, validFormRequest } from "@/lib/auth/http";
import { recoverySubmissionAvailable } from "@/lib/auth/recovery-availability";

export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return authRedirect(request, "/auth/error");
  if (!recoverySubmissionAvailable(process.env.NODE_ENV, request.nextUrl.hostname, process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    return authRedirect(request, "/auth/error", "Password recovery is temporarily unavailable.");
  }
  const { client, apply } = createRouteClient(request);
  const form = await request.formData();
  const email = form.get("email");
  if (typeof email === "string" && email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    // Supabase Auth applies its configured email/OTP limits. This endpoint
    // returns the same result whether or not an account exists.
    await client.auth.resetPasswordForEmail(email, { redirectTo: "http://localhost:3000/auth/confirm" });
  }
  return apply(authRedirect(request, "/auth/forgot-password?sent=1"));
}
