export function confirmationInput(token: unknown, rawType: unknown) {
  const type = rawType === "invite" || rawType === "recovery" ? rawType : null;
  if (!type) return { ok: false as const, reason: "input_type_invalid" };
  if (typeof token !== "string" || !token) return { ok: false as const, reason: "input_token_missing" };
  if (token.length < 16 || token.length > 2048) return { ok: false as const, reason: "input_token_length_invalid" };
  return { ok: true, token, type } as const;
}
