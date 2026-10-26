import { assertFlowSigningSecret, issueFlowTicket, type FlowType } from "./flow";
import type { AuthFlowStore } from "./auth-store";

type VerifiedUser = { id: string };
type VerifiedSession = { access_token: string };

export type ConfirmationEvent =
  | "signing_configuration_failed" | "store_check_failed" | "otp_request_failed"
  | "otp_expired" | "otp_rejected" | "otp_result_incomplete"
  | "session_verification_failed" | "ticket_registration_failed" | "confirmed";

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
  store: AuthFlowStore,
  type: FlowType,
  token: string,
  report: (event: ConfirmationEvent) => void = () => {},
): Promise<string | null> {
  let failure: ConfirmationEvent = "signing_configuration_failed";
  try {
    // A missing secret must not consume a valid one-time invitation or recovery link.
    assertFlowSigningSecret();
    failure = "store_check_failed";
    if (!await store.ready()) throw new Error("Auth flow store unavailable.");
    failure = "otp_request_failed";
    const verified = await gateway.verifyOtp({ token_hash: token, type });
    if (verified.error) {
      // Whitelist a fixed diagnostic label, never serialize provider errors.
      const expired = typeof verified.error === "object" && verified.error !== null &&
        "code" in verified.error && verified.error.code === "otp_expired";
      report(expired ? "otp_expired" : "otp_rejected");
      return null;
    }
    if (!verified.data.user || !verified.data.session) { report("otp_result_incomplete"); return null; }
    failure = "session_verification_failed";
    const current = await gateway.getUser();
    if (current.error || current.data.user?.id !== verified.data.user.id) { report(failure); return null; }
    failure = "ticket_registration_failed";
    const ticket = issueFlowTicket(type, verified.data.user.id);
    await store.register(ticket, verified.data.user.id, type);
    report("confirmed");
    return ticket;
  } catch (error) {
    report(failure);
    throw error;
  }
}
