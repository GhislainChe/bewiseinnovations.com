import { passwordIssue, readFlowTicket, type FlowType } from "./flow";
import type { AuthFlowStore } from "./auth-store";

export interface PasswordGateway {
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  updateUser(input: { password: string }): Promise<{ error: unknown }>;
  signOut(input: { scope: "local" }): Promise<{ error: unknown }>;
}

export type PasswordOutcome =
  | { kind: "denied" }
  | { kind: "invalid" }
  | { kind: "validation"; message: string }
  | { kind: "save_failed" }
  | { kind: "saved" };

export async function changePasswordAfterConfirmation(
  gateway: PasswordGateway,
  store: AuthFlowStore,
  ticket: string | undefined,
  type: FlowType,
  password: unknown,
  confirmation: unknown,
): Promise<PasswordOutcome> {
  const { data, error } = await gateway.getUser();
  if (error || !data.user || !readFlowTicket(ticket, type, data.user.id)) return { kind: "denied" };
  if (typeof password !== "string" || typeof confirmation !== "string" || password.length > 1024) {
    return { kind: "invalid" };
  }
  const issue = passwordIssue(password, confirmation);
  if (issue) return { kind: "validation", message: issue };
  // The database UPDATE is atomic; only one concurrent request can redeem.
  if (!await store.redeem(ticket!, data.user.id, type)) return { kind: "denied" };
  try {
    const result = await gateway.updateUser({ password });
    if (result.error) {
      await gateway.signOut({ scope: "local" });
      return { kind: "save_failed" };
    }
  } catch {
    try { await gateway.signOut({ scope: "local" }); } catch { /* The ticket remains consumed. */ }
    return { kind: "save_failed" };
  }
  await gateway.signOut({ scope: "local" });
  return { kind: "saved" };
}
