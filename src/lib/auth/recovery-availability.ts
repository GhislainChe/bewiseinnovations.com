export const RECOVERY_TEST_ORIGIN = "http://localhost:3000";
export const RECOVERY_REDIRECT_URL = `${RECOVERY_TEST_ORIGIN}/auth/confirm`;
const HOSTED_TEST_PROJECT_URL = "https://onfxxtvfprjnqsxdmhkp.supabase.co";

export type RecoveryEnvironment = {
  runtime: string | undefined;
  requestUrl: string;
  host: string | null;
  forwardedHost: string | null;
  forwardedProto: string | null;
  supabaseUrl: string | undefined;
  mode?: string;
  testOrigin?: string;
  managedDeployment?: boolean;
};

/** Configuration gate only. The route also validates keys and checks the store. */
export function recoverySubmissionAvailable(config: RecoveryEnvironment): boolean {
  if (config.runtime !== "development" || config.managedDeployment) return false;
  try {
    const request = new URL(config.requestUrl);
    if (request.origin !== RECOVERY_TEST_ORIGIN || config.host !== "localhost:3000") return false;
    // Forwarded headers never select the trusted origin; conflicting ones are rejected.
    if (config.forwardedHost !== null && config.forwardedHost !== "localhost:3000") return false;
    if (config.forwardedProto !== null && config.forwardedProto !== "http") return false;
    const target = new URL(config.supabaseUrl ?? "");
    if (target.username || target.password || target.search || target.hash || target.pathname !== "/") return false;
    const mode = config.mode ?? "local";
    if (mode === "local") {
      return target.protocol === "http:" && ["localhost", "127.0.0.1"].includes(target.hostname);
    }
    return mode === "hosted-local-test" && config.testOrigin === RECOVERY_TEST_ORIGIN &&
      target.origin === HOSTED_TEST_PROJECT_URL;
  } catch {
    return false;
  }
}
