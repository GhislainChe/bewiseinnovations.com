/** The gateway must use getClaims (signature/expiry verified), never decoded cookies. */
export interface AssuranceGateway {
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  getClaims(): Promise<{ data: { claims: Record<string, unknown> } | null; error: unknown }>;
}

export async function verifiedIdentity(gateway: AssuranceGateway): Promise<{ id: string; aal: "aal1" | "aal2" } | null> {
  try {
    const user = await gateway.getUser();
    if (user.error || !user.data.user) return null;
    const result = await gateway.getClaims();
    const claims = result.data?.claims;
    if (result.error || !claims || claims.sub !== user.data.user.id || claims.role !== "authenticated" ||
        typeof claims.exp !== "number" || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000 ||
        typeof claims.session_id !== "string" || !claims.session_id ||
        (claims.aal !== "aal1" && claims.aal !== "aal2")) return null;
    return { id: user.data.user.id, aal: claims.aal };
  } catch { return null; }
}
