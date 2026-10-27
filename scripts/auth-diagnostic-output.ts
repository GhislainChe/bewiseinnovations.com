import { safeCookieDiagnosticLine } from "../src/lib/auth/cookie-diagnostics";

const events = new Set([
  "origin_header_present", "origin_header_absent",
  ...["localhost", "loopback_ip", "other", "unconfigured"].map(value => `origin_expected_${value}`),
  ...["localhost", "loopback_ip", "other", "absent"].flatMap(value => [`origin_request_host_${value}`, `origin_request_url_${value}`]),
  ...["matched", "configuration_invalid", "header_missing", "header_null", "header_mismatch", "host_mismatch", "forwarded_host_mismatch", "forwarded_proto_mismatch"].map(value => `origin_reason_${value}`),
  "input_type_invalid", "input_token_missing", "input_token_length_invalid", "input_field_count_invalid",
  "ready", "project_mismatch", "recovery_not_disabled", "client_configuration_failed",
  "signing_configuration_failed", "store_configuration_failed", "store_check_failed",
  "form_rejected", "input_rejected", "otp_request_failed", "otp_expired", "otp_rejected",
  "form_received", "origin_rejected", "body_size_rejected", "content_type_rejected", "form_parse_failed",
  "otp_result_incomplete", "session_verification_failed", "ticket_registration_failed", "confirmed",
]);

/** Never forward child logs, URLs, arbitrary errors or even extra suffix text. */
export function safeAuthDiagnosticLine(line: string): string | null {
  const cookieLine = safeCookieDiagnosticLine(line.trim());
  if (cookieLine) return cookieLine;
  const match = /^(auth_preflight|auth_confirmation) ([a-z_]+)$/.exec(line.trim());
  return match && events.has(match[2]) ? `${match[1]} ${match[2]}` : null;
}

/** Only Next's server records containing exact fixed labels and elapsed times. */
export function safeAuthDiagnosticRecord(line: string): string | null {
  try {
    const record: unknown = JSON.parse(line);
    if (!record || typeof record !== "object") return null;
    const value = record as { source?: unknown; timestamp?: unknown; message?: unknown };
    if (value.source !== "Server" || typeof value.timestamp !== "string" ||
      !/^\d{2,}:\d{2}:\d{2}\.\d{3}$/.test(value.timestamp) || typeof value.message !== "string") return null;
    // Next's JSON log quotes the second console argument; terminal stdout does not.
    const serialized = /^(auth_preflight|auth_confirmation) "([a-z_]+)"$/.exec(value.message.trim());
    const safe = safeAuthDiagnosticLine(serialized ? `${serialized[1]} ${serialized[2]}` : value.message);
    return safe ? `[elapsed ${value.timestamp}] ${safe}` : null;
  } catch {
    return null;
  }
}
