import { verifiedIdentity, type AssuranceGateway } from "./assurance";

export interface PasswordMfaGateway extends AssuranceGateway {
  mfa: { listFactors(): Promise<{ data: { all: { factor_type: string; status: string }[] } | null; error: unknown }> };
}

/** Check before redeeming a ticket: enrolled users must step up first. */
export async function passwordMfaState(gateway: PasswordMfaGateway, expectedUserId: string): Promise<"ready" | "required" | "denied"> {
  const identity = await verifiedIdentity(gateway);
  if (!identity || identity.id !== expectedUserId) return "denied";
  try {
    const factors = await gateway.mfa.listFactors();
    if (factors.error || !factors.data) return "denied";
    return factors.data.all.some(f => f.factor_type === "totp" && f.status === "verified") && identity.aal !== "aal2"
      ? "required" : "ready";
  } catch { return "denied"; }
}
