import type { AuthFlowStore } from "./auth-store";

export interface RecoveryGateway {
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: unknown }>;
}

/** Always return the same result; store/provider errors must never reveal users. */
export async function requestRecoveryEmail(
  gateway: RecoveryGateway,
  store: Pick<AuthFlowStore, "consumeRecoveryBudget">,
  input: unknown,
): Promise<void> {
  if (typeof input !== "string") return;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  try {
    if (!await store.consumeRecoveryBudget(email)) return;
    await gateway.resetPasswordForEmail(email, { redirectTo: "http://localhost:3000/auth/confirm" });
  } catch {
    // Fail closed: no email is requested when the shared limiter is unavailable.
  }
}
