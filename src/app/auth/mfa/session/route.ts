import { NextResponse, type NextRequest } from "next/server";
import { createRouteClient } from "@/lib/supabase/route";
import { mfaOperation, mfaStatus } from "@/lib/auth/mfa";
import { validFormRequest } from "@/lib/auth/http";
import { createSupabaseAuthGateway } from "@/lib/auth/supabase-gateway";
import { getCurrentTeamMember } from "@/lib/auth/core";
import { FLOW_COOKIE_NAME, readFlowTicket } from "@/lib/auth/flow";

function response(data: object, status = 200) {
  return NextResponse.json(data, { status, headers: { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" } });
}
export async function GET(request: NextRequest) {
  try {
    const { client, apply } = createRouteClient(request);
    const state = await mfaStatus(client);
    if (!state) return apply(response({ error: "Sign in to continue." }, 401));
    const member = state.aal === "aal2" ? await getCurrentTeamMember(createSupabaseAuthGateway(client)) : null;
    const { data } = await client.auth.getUser();
    const recovery = Boolean(data.user && readFlowTicket(request.cookies.get(FLOW_COOKIE_NAME)?.value, "recovery", data.user.id));
    return apply(response({ ...state, staffAccess: Boolean(member), recovery }));
  } catch { return response({ error: "Authentication status unavailable." }, 503); }
}
export async function POST(request: NextRequest) {
  if (!validFormRequest(request)) return response({ error: "Request rejected." }, 403);
  try {
    const { client, apply } = createRouteClient(request);
    try {
      const form = await request.formData();
      if ([...form.keys()].some(k => !["operation","factor_id","code"].includes(k)) ||
          [...new Set(form.keys())].some(k => form.getAll(k).length !== 1)) return apply(response({ error: "Request rejected." }, 400));
      const result = await mfaOperation(client, form);
      return apply(result ? response(result) : response({ error: "Unable to complete MFA. Check your session and authenticator code." }, 400));
    } catch { return apply(response({ error: "MFA is unavailable. Stop and retry from a fresh page." }, 503)); }
  } catch { return response({ error: "MFA is unavailable." }, 503); }
}
