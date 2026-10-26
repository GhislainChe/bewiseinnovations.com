export type SignOutGateway = { signOut(input: { scope: "local" }): Promise<{ error: unknown }> };

/** No raw provider errors and no automatic retries after uncertain revocation. */
export async function endCurrentSession(gateway: SignOutGateway): Promise<boolean> {
  try {
    const { error } = await gateway.signOut({ scope: "local" });
    return !error;
  } catch { return false; }
}

export const SIGN_OUT_FAILED = "Sign-out could not be confirmed. Your password may have been saved. Retry sign-out or contact the administrator.";
export const SIGN_OUT_SUCCEEDED = "You have been signed out.";
