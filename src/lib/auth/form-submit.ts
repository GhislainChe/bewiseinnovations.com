export const AUTH_FORM_ACTIONS = ["/auth/confirm/complete", "/auth/set-password/complete", "/auth/reset-password/complete", "/auth/forgot-password/request", "/auth/sign-out/complete", "/auth/sign-in/complete"] as const;
export type AuthFormAction = typeof AUTH_FORM_ACTIONS[number];

/** One attempt per rendered form, including on network uncertainty. No retries. */
export function createAuthFormSubmitter(fetcher: typeof fetch, origin: string, navigate: (path: string) => void) {
  let attempted = false;
  return async (action: AuthFormAction, fields: URLSearchParams): Promise<"navigating" | "failed" | "duplicate"> => {
    if (attempted) return "duplicate";
    attempted = true;
    try {
      if (!AUTH_FORM_ACTIONS.includes(action)) return "failed";
      const response = await fetcher(new URL(action, origin), {
        method: "POST", body: fields, mode: "cors", credentials: "same-origin",
        headers: { "x-auth-form": "1" },
        referrerPolicy: "no-referrer", cache: "no-store", redirect: "error",
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) return "failed";
      const data: unknown = await response.json();
      if (!data || typeof data !== "object" || !("destination" in data) || typeof data.destination !== "string") return "failed";
      const destination = new URL(data.destination, origin);
      if (destination.origin !== origin || destination.hash ||
        [...destination.searchParams.keys()].some(key => key !== "message" && key !== "sent") ||
        !["/auth/error", "/auth/set-password", "/auth/reset-password", "/auth/forgot-password", "/auth/mfa"].includes(destination.pathname)) return "failed";
      navigate(destination.pathname + destination.search);
      return "navigating";
    } catch { return "failed"; }
  };
}
