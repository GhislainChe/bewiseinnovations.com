import type { AuthFlowStore } from "./auth-store";
import { assertFlowSigningSecret } from "./flow";
import { RECOVERY_REDIRECT_URL } from "./recovery-availability";

export interface RecoveryGateway {
  resetPasswordForEmail(email: string, options: { redirectTo: string }): Promise<{ error: unknown }>;
}

/** Always return the same result; store/provider errors must never reveal users. */
export async function requestRecoveryEmail(
  gateway: RecoveryGateway,
  store: Pick<AuthFlowStore, "ready" | "consumeRecoveryBudget">,
  input: unknown,
): Promise<void> {
  if (typeof input !== "string") return;
  const email = input.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  try {
    assertFlowSigningSecret();
    if (!await store.ready()) return;
    if (!await store.consumeRecoveryBudget(email)) return;
    await gateway.resetPasswordForEmail(email, { redirectTo: RECOVERY_REDIRECT_URL });
  } catch {
    // Fail closed: no email is requested when the shared limiter is unavailable.
  }
}
