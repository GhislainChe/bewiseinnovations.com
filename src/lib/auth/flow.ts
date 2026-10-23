import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type FlowType = "invite" | "recovery";

export function confirmationType(value: unknown): FlowType | null {
  return value === "invite" || value === "recovery" ? value : null;
}

export function sameOrigin(requestUrl: string, origin: string | null): boolean {
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(requestUrl).origin;
  } catch {
    return false;
  }
}

export function passwordIssue(password: string, confirmation: string): string | null {
  if (password.length < 12) return "Use at least 12 characters.";
  if (password !== confirmation) return "Passwords do not match.";
  return null;
}

function secret(): string {
  const value = process.env.AUTH_FLOW_SIGNING_SECRET;
  if (!value || value.length < 32) throw new Error("Auth flow signing secret is not configured.");
  return value;
}

/** Check configuration before consuming a one-time email token. */
export function assertFlowSigningSecret(): void {
  secret();
}

export function flowCookieOptions(protocol: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: protocol === "https:",
    path: "/auth",
    maxAge: 600,
  };
}

export function issueFlowTicket(type: FlowType, userId: string): string {
  const body = Buffer.from(JSON.stringify({ type, userId, expires: Date.now() + 10 * 60_000, nonce: randomBytes(32).toString("base64url") })).toString("base64url");
  const mac = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${mac}`;
}

export function ticketRecord(ticket: string | undefined, expected: FlowType, userId: string): { hashHex: string; expiresAt: string } | null {
  if (!ticket || ticket.length > 2048) return null;
  const parts = ticket.split(".");
  if (parts.length !== 2) return null;
  const actual = Buffer.from(parts[1], "base64url");
  const expectedMac = createHmac("sha256", secret()).update(parts[0]).digest();
  if (actual.length !== expectedMac.length || !timingSafeEqual(actual, expectedMac)) return null;
  try {
    const data: unknown = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    if (!data || typeof data !== "object") return null;
    const flow = data as { type?: unknown; userId?: unknown; expires?: unknown; nonce?: unknown };
    if (flow.type !== expected || flow.userId !== userId || typeof flow.expires !== "number"
      || flow.expires <= Date.now() || flow.expires > Date.now() + 11 * 60_000
      || typeof flow.nonce !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(flow.nonce)) return null;
    return {
      hashHex: createHash("sha256").update("auth-flow-ticket-id:").update(flow.nonce).digest("hex"),
      expiresAt: new Date(flow.expires).toISOString(),
    };
  } catch {
    return null;
  }
}

export function readFlowTicket(ticket: string | undefined, expected: FlowType, userId: string): boolean {
  return ticketRecord(ticket, expected, userId) !== null;
}

/** HMAC prevents an offline dictionary attack against stored email bucket keys. */
export function recoveryBudgetHashes(email: string): { emailHashHex: string; globalHashHex: string } {
  const normalized = email.trim().toLowerCase();
  return {
    emailHashHex: createHmac("sha256", secret()).update("recovery-email:").update(normalized).digest("hex"),
    globalHashHex: createHmac("sha256", secret()).update("recovery-global:v1").digest("hex"),
  };
}
