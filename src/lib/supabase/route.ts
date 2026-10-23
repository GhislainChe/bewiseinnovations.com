import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseConfig } from "@/lib/supabase/env";

/** Preserve Supabase's exact cookie options and cache headers on Route Handler responses. */
export function createRouteClient(request: NextRequest) {
  const { url, publishableKey } = getSupabaseConfig();
  const pending: Array<{ name: string; value: string; options: Parameters<NextResponse["cookies"]["set"]>[2] }> = [];
  const headers = new Map<string, string>();
  const client = createServerClient(url, publishableKey, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(cookiesToSet, responseHeaders) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          pending.push(cookie);
        }
        for (const [name, value] of Object.entries(responseHeaders ?? {})) headers.set(name, value);
      },
    },
  });
  return {
    client,
    apply(response: NextResponse) {
      for (const cookie of pending) response.cookies.set(cookie.name, cookie.value, cookie.options);
      for (const [name, value] of headers) response.headers.set(name, value);
      response.headers.set("Cache-Control", "private, no-store");
      return response;
    },
  };
}
