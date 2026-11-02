import "server-only";
import { createHmac } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { inspectAuthOrigin } from "@/lib/auth/origin";
import { assertLocalBusinessRuntime } from "./runtime";
import { parseProjectRequest } from "./validation";

export const SUBMISSION_FAILED = "Unable to accept this request. Check the form or try again later.";
export async function readBoundedJson(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.match(/^application\/json(?:;|$)/i) || !request.body) throw new Error();
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 16384) { await reader.cancel(); throw new Error(); }
      chunks.push(part.value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally { reader.releaseLock(); }
}

/** Separate privileged interface, fixed to one local ingress RPC. Not the Auth store. */
export function localRequestIngress() {
  assertLocalBusinessRuntime();
  const secret = process.env.SUPABASE_BUSINESS_INGRESS_SECRET_KEY;
  const signing = process.env.BUSINESS_SUBMISSION_SECRET;
  if (!secret || secret.length < 32 || secret.includes("REPLACE_WITH") || secret.startsWith("sb_publishable_") || !signing || signing.length < 32) throw new Error();
  const client = createClient("http://127.0.0.1:65421", secret, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: async (input, init) => {
      const u = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
      if (u.origin !== "http://127.0.0.1:65421" || u.pathname !== "/rest/v1/rpc/submit_project_request" || u.search || (init?.method ?? "GET").toUpperCase() !== "POST") throw new Error();
      return fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(10000) });
    } },
  });
  const hash = (v: string) => createHmac("sha256", signing).update(v).digest("hex");
  return async (payload: ReturnType<typeof parseProjectRequest>, key: string) => {
    const result = await client.rpc("submit_project_request", { p_payload: payload, p_idempotency_hex: hash("request-key:" + key), p_email_hex: hash("request-email:" + payload.email), p_global_hex: hash("request-global:v1") });
    if (result.error || typeof result.data !== "string" || !/^BWR-[a-f0-9]{32}$/.test(result.data)) throw new Error();
    return result.data;
  };
}
type Ingress = ReturnType<typeof localRequestIngress>;
export async function submitRequestHttp(request: Request, options: { ingress?: Ingress; env?: Readonly<Record<string, string | undefined>> } = {}) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow" };
  try {
    const env = options.env ?? process.env;
    assertLocalBusinessRuntime(env);
    if (!inspectAuthOrigin(request, { trustedOrigin: env.AUTH_TRUSTED_ORIGIN, runtime: env.NODE_ENV, managed: false }).allowed) throw new Error();
    const key = request.headers.get("idempotency-key");
    if (!key || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(key)) throw new Error();
    const payload = parseProjectRequest(await readBoundedJson(request));
    const reference = await (options.ingress ?? localRequestIngress())(payload, key);
    return Response.json({ reference }, { status: 202, headers });
  } catch {
    // Same response for validation, duplicates with different payload, quotas and store outage.
    return Response.json({ message: SUBMISSION_FAILED }, { status: 400, headers });
  }
}
