import { passwordIssue, readFlowTicket, type FlowType } from "./flow";
import type { AuthFlowStore } from "./auth-store";
import { endCurrentSession } from "./sign-out";

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
  | { kind: "sign_out_failed" }
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
  let updated = false;
  try {
    const result = await gateway.updateUser({ password });
    updated = !result.error;
  } catch { /* A failed/uncertain update still burns the ticket. */ }
  if (!await endCurrentSession(gateway)) return { kind: "sign_out_failed" };
  return updated ? { kind: "saved" } : { kind: "save_failed" };
}
