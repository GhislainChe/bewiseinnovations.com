import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

// Internal routes are reserved for a later stage. Extend this when protected
// routes are added; each route must also check authorization server-side.
export const config = { matcher: ["/internal/:path*"] };
