import { passwordIssue, readFlowTicket, type FlowType } from "./flow";

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
  const result = await gateway.updateUser({ password });
  if (result.error) return { kind: "save_failed" };
  await gateway.signOut({ scope: "local" });
  return { kind: "saved" };
}
