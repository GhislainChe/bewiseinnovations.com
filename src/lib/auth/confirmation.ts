import { assertFlowSigningSecret, issueFlowTicket, type FlowType } from "./flow";

type VerifiedUser = { id: string };
type VerifiedSession = { access_token: string };

export interface ConfirmationGateway {
  verifyOtp(input: { token_hash: string; type: FlowType }): Promise<{
    data: { user: VerifiedUser | null; session: VerifiedSession | null };
    error: unknown;
  }>;
  getUser(): Promise<{ data: { user: VerifiedUser | null }; error: unknown }>;
}

/** Called only by the POST route; GET never calls this or Supabase Auth. */
export async function verifyConfirmation(
  gateway: ConfirmationGateway,
  type: FlowType,
  token: string,
): Promise<string | null> {
  // A missing secret must not consume a valid one-time invitation or recovery link.
  assertFlowSigningSecret();
  const verified = await gateway.verifyOtp({ token_hash: token, type });
  if (verified.error || !verified.data.user || !verified.data.session) return null;
  const current = await gateway.getUser();
  if (current.error || current.data.user?.id !== verified.data.user.id) return null;
  return issueFlowTicket(type, verified.data.user.id);
}
