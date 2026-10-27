import type { SupabaseClient } from "@supabase/supabase-js";
import { verifiedIdentity } from "./assurance";

export async function mfaStatus(client: SupabaseClient) {
  const identity = await verifiedIdentity(client.auth);
  if (!identity) return null;
  const result = await client.auth.mfa.listFactors();
  if (result.error) throw new Error("MFA unavailable.");
  return { aal: identity.aal, factors: result.data.all.filter(f => f.factor_type === "totp")
    .map(f => ({ id: f.id, verified: f.status === "verified" })) };
}

/** Uses only the caller's SSR Auth client; no user IDs or assurances from input. */
export async function mfaOperation(client: SupabaseClient, form: FormData) {
  const state = await mfaStatus(client);
  if (!state) return null;
  const operation = form.get("operation");
  if (operation === "enroll") {
    // An AAL1 session cannot attach an attacker's factor to an enrolled account.
    if (state.factors.length >= 5 || (state.factors.some(f => f.verified) && state.aal !== "aal2")) return null;
    const result = await client.auth.mfa.enroll({ factorType: "totp", issuer: "BE WISE INNOVATIONS",
      friendlyName: `Authenticator ${state.factors.length + 1}` });
    if (result.error || result.data.type !== "totp") return null;
    return { enrollment: { id: result.data.id, secret: result.data.totp.secret } };
  }
  if (operation === "verify") {
    const id = form.get("factor_id"), code = form.get("code");
    if (typeof id !== "string" || !state.factors.some(f => f.id === id) ||
        typeof code !== "string" || !/^[0-9]{6}$/.test(code)) return null;
    const result = await client.auth.mfa.challengeAndVerify({ factorId: id, code });
    if (result.error || (await verifiedIdentity(client.auth))?.aal !== "aal2") return null;
    return { verified: true };
  }
  return null;
}
